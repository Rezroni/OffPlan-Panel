import { NextRequest, NextResponse } from "next/server";
import { getProjectById, getProjectUnitTypes, getCmaAnalysisForProject } from "@/server/dal/catalog";
import { getDeveloperById } from "@/server/dal/developers";
import { getClusterPipelineAnalysis } from "@/server/dal/pipeline";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
} from "@/domain/exit/exit-scenario-engine";
import {
  StudioProjectFacts,
  generateReelsScript,
} from "@/domain/content/content-studio";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, unitTypeId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing required projectId" }, { status: 400 });
    }

    const [project, unitTypes, cmaData, pipelineAnalysis] = await Promise.all([
      getProjectById(projectId),
      getProjectUnitTypes(projectId),
      getCmaAnalysisForProject({ projectId, bedrooms: 1 }),
      getClusterPipelineAnalysis(projectId),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const developerTrackRecord = project.developerId
      ? await getDeveloperById(project.developerId)
      : null;

    const unit =
      (unitTypeId && unitTypes.find((u) => u.id === unitTypeId)) ||
      unitTypes[0] || {
        id: "default-unit",
        bedrooms: 1,
        unitTypeLabel: "1BR Apartment",
        areaSqftMin: 850,
        areaSqftMax: 850,
        listPriceAed: 1800000,
        netPriceAed: 1728000,
      };

    const priceAed = unit.netPriceAed || unit.listPriceAed || 1800000;
    const areaSqft = unit.areaSqftMin || unit.areaSqftMax || 850;
    const pricePsf = Math.round(priceAed / areaSqft);

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

    const flipBreakEvenPsf = Math.round(assignmentResale.breakEvenPsfAED.toNumber());
    const flipBaselineRoiPct = Number(assignmentResale.scenarios[1].cashOnCashRoiPercent.toFixed(1));
    const holdNetYieldPct = Number(holdAnalysis.rentalMetrics.netYieldOnCost.toFixed(2));

    const facts: StudioProjectFacts = {
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
      flipBreakEvenPsf,
      flipBaselineRoiPct,
      holdNetYieldPct,
      competingCollisionCount: pipelineAnalysis?.collisionWindowProjectsCount || 0,
      competingSupplyRisk: pipelineAnalysis?.supplyPressureRisk || "LOW_PRESSURE",
      agentName: "Mokhamed",
    };

    const dualScript = generateReelsScript(facts);

    return NextResponse.json({
      success: true,
      facts,
      dualScript,
    });
  } catch (error: any) {
    console.error("Studio generate script error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate script" },
      { status: 500 }
    );
  }
}
