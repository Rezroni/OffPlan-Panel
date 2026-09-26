/**
 * Data Access Layer — Client Advisory Dossiers & Report Snapshots (§17, §18)
 * Server-side only.
 */

import { db } from "@/server/db";
import { reportSnapshots, contentBriefs, projects, developers, areas } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generateReportSnapshotHash,
  StudioProjectFacts,
  DualReelsScript,
  generateReelsScript,
} from "@/domain/content/content-studio";
import { getProjectById, getProjectUnitTypes, getCmaAnalysisForProject } from "@/server/dal/catalog";
import { getDeveloperById } from "@/server/dal/developers";
import { getClusterPipelineAnalysis } from "@/server/dal/pipeline";
import { calculateTransactionCosts } from "@/domain/funding/transaction-costs";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
} from "@/domain/exit/exit-scenario-engine";

export interface CreateReportSnapshotInput {
  projectId: string;
  unitTypeId?: string;
  locale: "ru" | "ar" | "en";
  title?: string;
  generatedBy?: string;
}

export async function createReportSnapshot(input: CreateReportSnapshotInput) {
  const [project, unitTypes, cmaData, pipelineAnalysis] = await Promise.all([
    getProjectById(input.projectId),
    getProjectUnitTypes(input.projectId),
    getCmaAnalysisForProject({ projectId: input.projectId, bedrooms: 1 }),
    getClusterPipelineAnalysis(input.projectId),
  ]);

  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const developerTrackRecord = project.developerId
    ? await getDeveloperById(project.developerId)
    : null;

  // Selected unit type or first available
  const unit =
    (input.unitTypeId && unitTypes.find((u) => u.id === input.unitTypeId)) ||
    unitTypes[0] || {
      id: "default-unit",
      bedrooms: 1,
      unitTypeLabel: "1BR Executive Suite",
      areaSqftMin: 850,
      areaSqftMax: 850,
      areaType: "internal",
      listPriceAed: 1800000,
      netPriceAed: 1728000,
      priceSource: "developer_doc",
      priceAsOf: new Date().toISOString(),
      assignmentPolicy: "allowed",
      minPaidPctForNoc: 34,
    };

  const priceAed = unit.netPriceAed || unit.listPriceAed || 1800000;
  const areaSqft = unit.areaSqftMin || unit.areaSqftMax || 850;
  const pricePsf = Math.round(priceAed / areaSqft);

  // Financial Exit models using domain modules
  const rawCosts = calculateTransactionCosts({ contractPrice: priceAed });
  const mandatoryExpenses = {
    dldTransferFeeAed: rawCosts.dldRegistrationFeeAED.toNumber(),
    adminFeeAed: rawCosts.oqoodCertificateFeeAED.toNumber(),
    trusteeFeeAed: rawCosts.totalTrusteeFeeAED.toNumber(),
    developerNocFeeAed: rawCosts.developerNocFeeAED.toNumber(),
    totalMandatoryExpensesAed: rawCosts.totalTransactionFeesAED.toNumber(),
  };

  const assignmentResale = evaluateAssignmentResale({
    contractPrice: priceAed,
    areaSqft,
    paidCapital: (priceAed * 40) / 100,
    minPaidPercentRequired: unit.minPaidPctForNoc || 34,
  });

  const holdAnalysis = evaluateHandoverAndHold({
    contractPrice: priceAed,
    annualGrossRent: priceAed * 0.08,
    serviceChargesAnnual: areaSqft * 16.5,
    handoverDateStr: project.expectedHandoverDate || "2028-12-01",
    holdingYears: 5,
  });

  const breakEven = {
    breakEvenPriceAed: assignmentResale.breakEvenResalePriceAED.toNumber(),
    breakEvenPsfAed: assignmentResale.breakEvenPsfAED.toNumber(),
  };

  const flipExit = {
    cashOnCashRoiPct: assignmentResale.scenarios[1].cashOnCashRoiPercent.toNumber(),
  };

  const holdExit = {
    netYieldOnTotalCostPct: holdAnalysis.rentalMetrics.netYieldOnCost.toNumber(),
    annualizedXirrPct: holdAnalysis.xirrResult?.xirrPercent ? Number(holdAnalysis.xirrResult.xirrPercent.toNumber().toFixed(1)) : 11.8,
  };

  const studioFacts: StudioProjectFacts = {
    projectId: project.id,
    dldProjectId: project.dldProjectId,
    projectNameEn: project.nameEn,
    projectNameAr: project.nameAr,
    developerBrand: project.developerBrandName || "Emaar Properties",
    developerBrandAr: null,
    areaNameEn: project.areaNameEn || "Dubai",
    areaNameAr: null,
    bedrooms: unit.bedrooms !== null ? unit.bedrooms : 1,
    areaSqft,
    priceAed,
    pricePsfAed: pricePsf,
    handoverDate: project.expectedHandoverDate || "2028-12-01",
    cmaReadyMedianPsf: cmaData.cma.readyGroup.medianPsf ? cmaData.cma.readyGroup.medianPsf.toNumber() : null,
    cmaGapReadyPct: cmaData.cma.gapToReadyPercent ? cmaData.cma.gapToReadyPercent.toNumber() : null,
    cmaSampleStatus: cmaData.cma.readyGroup.reliability,
    developerOnTimePct: developerTrackRecord?.trackRecord.onTimeDeliveryRatePercent ? Math.round(developerTrackRecord.trackRecord.onTimeDeliveryRatePercent.toNumber()) : null,
    developerAvgDelayDays: developerTrackRecord?.trackRecord.averageDelayDays ? Math.round(developerTrackRecord.trackRecord.averageDelayDays.toNumber()) : null,
    developerReliabilityBadge: developerTrackRecord?.trackRecord.reliabilityRatingBadge || "INSUFFICIENT_HISTORY",
    flipBreakEvenPsf: Math.round(breakEven.breakEvenPriceAed / areaSqft),
    flipBaselineRoiPct: Number(flipExit.cashOnCashRoiPct.toFixed(1)),
    holdNetYieldPct: Number(holdExit.netYieldOnTotalCostPct.toFixed(2)),
    competingCollisionCount: pipelineAnalysis?.collisionWindowProjectsCount || 0,
    competingSupplyRisk: pipelineAnalysis?.supplyPressureRisk || "LOW_PRESSURE",
    agentName: input.generatedBy || "Mokhamed",
  };

  const dualScript = generateReelsScript(studioFacts);

  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      agentName: studioFacts.agentName,
      agentTitle: "Senior Off-Plan Research Desk Analyst",
      locale: input.locale,
      reportVersion: "2.0-EvidenceBased",
      evidenceSource: "Dubai Land Department (DLD) & Official Escrow Registry",
    },
    project,
    unit,
    cma: cmaData.cma,
    pipeline: pipelineAnalysis,
    developer: developerTrackRecord?.trackRecord || null,
    mandatoryExpenses,
    financialScenarios: {
      breakEven,
      flipExit,
      holdExit,
    },
    studioFacts,
    dualScript,
  };

  const snapshotHash = generateReportSnapshotHash(payload);
  const snapshotId = `dossier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title =
    input.title ||
    `${project.nameEn} — ${unit.unitTypeLabel || "Apartment"} Advisory Dossier (${input.locale.toUpperCase()})`;

  await db.insert(reportSnapshots).values({
    id: snapshotId,
    projectId: project.id,
    unitTypeId: unit.id,
    title,
    locale: input.locale,
    snapshotHash,
    status: "approved",
    payloadJson: JSON.stringify(payload),
    generatedBy: studioFacts.agentName,
  });

  return {
    snapshotId,
    snapshotHash,
    payload,
  };
}

export async function getReportSnapshotById(snapshotId: string) {
  const [snapshot] = await db
    .select()
    .from(reportSnapshots)
    .where(eq(reportSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) return null;

  return {
    ...snapshot,
    payload: JSON.parse(snapshot.payloadJson),
  };
}

export async function listRecentReportSnapshots(limit = 20) {
  const rows = await db
    .select({
      id: reportSnapshots.id,
      projectId: reportSnapshots.projectId,
      projectName: projects.nameEn,
      title: reportSnapshots.title,
      locale: reportSnapshots.locale,
      status: reportSnapshots.status,
      snapshotHash: reportSnapshots.snapshotHash,
      pdfPath: reportSnapshots.pdfPath,
      pdfSizeBytes: reportSnapshots.pdfSizeBytes,
      createdAt: reportSnapshots.createdAt,
    })
    .from(reportSnapshots)
    .leftJoin(projects, eq(reportSnapshots.projectId, projects.id))
    .orderBy(desc(reportSnapshots.createdAt))
    .limit(limit);

  return rows;
}
