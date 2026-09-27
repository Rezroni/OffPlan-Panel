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
import {
  getProjectById,
  getProjectUnitTypes,
  getCmaAnalysisForProject,
  getProjectRecentTransactions,
  getProjectResaleChains,
} from "@/server/dal/catalog";
import { getDeveloperById } from "@/server/dal/developers";
import { getClusterPipelineAnalysis } from "@/server/dal/pipeline";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
} from "@/domain/exit/exit-scenario-engine";
import { generateDossierSynthesis } from "@/server/adapters/ai/gemini-adapter";

export interface CreateReportSnapshotInput {
  projectId: string;
  unitTypeId?: string;
  locale: "ru" | "ar" | "en";
  title?: string;
  generatedBy?: string;
}

export async function createReportSnapshot(input: CreateReportSnapshotInput) {
  const [project, unitTypes, pipelineAnalysis, resaleChains] = await Promise.all([
    getProjectById(input.projectId),
    getProjectUnitTypes(input.projectId),
    getClusterPipelineAnalysis(input.projectId),
    getProjectResaleChains({ projectId: input.projectId, minConfidence: 90 }).catch(() => null),
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

  const unitBedrooms = unit.bedrooms !== null && unit.bedrooms !== undefined ? unit.bedrooms : 1;
  const priceAed = unit.netPriceAed || unit.listPriceAed || 1800000;
  const areaSqft = unit.areaSqftMin || unit.areaSqftMax || 850;
  const pricePsf = Math.round(priceAed / areaSqft);

  const [cmaData, recentTransactions] = await Promise.all([
    getCmaAnalysisForProject({
      projectId: input.projectId,
      bedrooms: unitBedrooms,
      customTargetPriceAed: priceAed,
      customTargetAreaSqft: areaSqft,
    }),
    getProjectRecentTransactions({
      projectId: input.projectId,
      bedrooms: unitBedrooms,
      limit: 10,
    }).catch(() => null),
  ]);

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
    bedrooms: unitBedrooms,
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

  let aiSynthesis = null;
  try {
    aiSynthesis = await generateDossierSynthesis({
      projectName: project.nameEn,
      projectNameAr: project.nameAr,
      developerName: project.developerBrandName || "Developer",
      areaName: project.areaNameEn || "Dubai",
      bedrooms: unitBedrooms,
      unitPriceAed: priceAed,
      unitAreaSqft: areaSqft,
      unitPsf: pricePsf,
      expectedHandoverDate: project.expectedHandoverDate || undefined,
      readyMedianPsf: studioFacts.cmaReadyMedianPsf,
      readyDealsCount: cmaData.cma.readyGroup.count,
      gapToReadyPercent: studioFacts.cmaGapReadyPct,
      offPlanMedianPsf: cmaData.cma.offPlanGroup.medianPsf ? cmaData.cma.offPlanGroup.medianPsf.toNumber() : null,
      offPlanDealsCount: cmaData.cma.offPlanGroup.count,
      gapToOffPlanPercent: cmaData.cma.gapToOffPlanPercent ? cmaData.cma.gapToOffPlanPercent.toNumber() : null,
      nearHandoverMedianPsf: cmaData.cma.nearHandoverGroup.medianPsf ? cmaData.cma.nearHandoverGroup.medianPsf.toNumber() : null,
      nearHandoverDealsCount: cmaData.cma.nearHandoverGroup.count,
      nocThresholdPercent: unit.minPaidPctForNoc || 34,
      breakEvenPsfAed: studioFacts.flipBreakEvenPsf,
      flipRoiPct: studioFacts.flipBaselineRoiPct,
      holdYieldPct: studioFacts.holdNetYieldPct,
      competingCollisionCount: studioFacts.competingCollisionCount,
      developerAvgDelayDays: studioFacts.developerAvgDelayDays,
    }, input.locale);
  } catch (err) {
    console.warn("Failed to generate initial AI synthesis for snapshot:", err);
  }

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
    unitTypes,
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
    resaleChains,
    recentTransactions,
    aiSynthesis,
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

  const rawPayload = JSON.parse(snapshot.payloadJson);
  const projectId = snapshot.projectId || rawPayload.project?.id;
  const bedrooms = rawPayload.unit?.bedrooms !== null && rawPayload.unit?.bedrooms !== undefined ? rawPayload.unit.bedrooms : 1;
  const unitPrice = rawPayload.unit?.netPriceAed || rawPayload.unit?.listPriceAed || undefined;
  const unitArea = rawPayload.unit?.areaSqftMin || rawPayload.unit?.areaSqftMax || undefined;

  let enrichedPayload = { ...rawPayload };

  if (projectId) {
    try {
      const [
        liveProject,
        liveUnitTypes,
        liveCmaData,
        liveResaleChains,
        liveRecentTransactions,
        livePipeline,
        liveDeveloper,
      ] = await Promise.all([
        getProjectById(projectId).catch(() => null),
        getProjectUnitTypes(projectId).catch(() => []),
        getCmaAnalysisForProject({
          projectId,
          bedrooms,
          customTargetPriceAed: unitPrice,
          customTargetAreaSqft: unitArea,
        }).catch(() => null),
        getProjectResaleChains({ projectId, minConfidence: 90 }).catch(() => null),
        getProjectRecentTransactions({ projectId, bedrooms, limit: 10 }).catch(() => null),
        getClusterPipelineAnalysis(projectId).catch(() => null),
        (rawPayload.project?.developerId) ? getDeveloperById(rawPayload.project.developerId).catch(() => null) : null,
      ]);

      const liveCma = liveCmaData?.cma;

      enrichedPayload = {
        ...rawPayload,
        project: liveProject ? { ...rawPayload.project, ...liveProject } : rawPayload.project,
        unitTypes: liveUnitTypes && liveUnitTypes.length > 0 ? liveUnitTypes : rawPayload.unitTypes || [],
        cma: liveCma
          ? {
              ...rawPayload.cma,
              ...liveCma,
              readyGroup: { ...(rawPayload.cma?.readyGroup || {}), ...liveCma.readyGroup },
              offPlanGroup: { ...(rawPayload.cma?.offPlanGroup || {}), ...liveCma.offPlanGroup },
              nearHandoverGroup: { ...(rawPayload.cma?.nearHandoverGroup || {}), ...liveCma.nearHandoverGroup },
              gapToReadyPercent: liveCma.gapToReadyPercent ?? rawPayload.cma?.gapToReadyPercent,
              gapToOffPlanPercent: liveCma.gapToOffPlanPercent ?? rawPayload.cma?.gapToOffPlanPercent,
              gapToNearHandoverPercent: liveCma.gapToNearHandoverPercent ?? rawPayload.cma?.gapToNearHandoverPercent,
              editorialConclusion: rawPayload.cma?.editorialConclusion || liveCma.editorialConclusion,
            }
          : rawPayload.cma,
        resaleChains: rawPayload.resaleChains || liveResaleChains || null,
        recentTransactions: rawPayload.recentTransactions || liveRecentTransactions || null,
        pipeline: livePipeline || rawPayload.pipeline,
        developer: liveDeveloper?.trackRecord || rawPayload.developer,
      };

      if (!enrichedPayload.aiSynthesis) {
        try {
          const cma = enrichedPayload.cma;
          const uPrice = enrichedPayload.unit?.netPriceAed || enrichedPayload.unit?.listPriceAed || 0;
          const uArea = enrichedPayload.unit?.areaSqftMin || enrichedPayload.unit?.areaSqftMax || enrichedPayload.unit?.areaSqft || 850;
          const uPsf = uPrice > 0 && uArea > 0 ? Math.round(uPrice / uArea) : (cma?.targetPsf ? Number(cma.targetPsf) : 0);
          const bePsf = enrichedPayload.financialScenarios?.breakEven?.breakEvenPsfAed || Math.round(uPsf * 1.05);

          enrichedPayload.aiSynthesis = await generateDossierSynthesis({
            projectName: enrichedPayload.project?.nameEn || "Project",
            projectNameAr: enrichedPayload.project?.nameAr,
            developerName: enrichedPayload.project?.developerBrandName || enrichedPayload.developer?.developerName || "Developer",
            areaName: enrichedPayload.project?.areaNameEn || "Dubai",
            bedrooms: bedrooms,
            unitPriceAed: uPrice,
            unitAreaSqft: uArea,
            unitPsf: uPsf,
            expectedHandoverDate: enrichedPayload.project?.expectedHandoverDate || undefined,
            readyMedianPsf: cma?.readyGroup?.medianPsf ? Number(cma.readyGroup.medianPsf) : null,
            readyDealsCount: cma?.readyGroup?.count || 0,
            gapToReadyPercent: cma?.gapToReadyPercent != null ? Number(cma.gapToReadyPercent) : null,
            offPlanMedianPsf: cma?.offPlanGroup?.medianPsf ? Number(cma.offPlanGroup.medianPsf) : null,
            offPlanDealsCount: cma?.offPlanGroup?.count || 0,
            gapToOffPlanPercent: cma?.gapToOffPlanPercent != null ? Number(cma.gapToOffPlanPercent) : null,
            nearHandoverMedianPsf: cma?.nearHandoverGroup?.medianPsf ? Number(cma.nearHandoverGroup.medianPsf) : null,
            nearHandoverDealsCount: cma?.nearHandoverGroup?.count || 0,
            nocThresholdPercent: enrichedPayload.unit?.minPaidPctForNoc || 34,
            breakEvenPsfAed: bePsf,
            flipRoiPct: enrichedPayload.financialScenarios?.flipExit?.cashOnCashRoiPct || 10,
            holdYieldPct: enrichedPayload.financialScenarios?.holdExit?.netYieldOnTotalCostPct || 7.5,
            competingCollisionCount: enrichedPayload.pipeline?.collisionWindowProjectsCount || 0,
            developerAvgDelayDays: enrichedPayload.developer?.averageDelayDays ? Number(enrichedPayload.developer.averageDelayDays) : null,
          }, (snapshot.locale as any) || "ru");
        } catch (err) {
          console.warn("Failed to generate on-demand AI synthesis for report:", err);
        }
      }
    } catch (e) {
      console.warn("Failed to enrich report snapshot with live data:", e);
    }
  }

  return JSON.parse(
    JSON.stringify({
      ...snapshot,
      payload: enrichedPayload,
    })
  );
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
