/**
 * /studio — Dual RU/AR Content Studio & Reels Generator (§16, §18)
 * Server Component
 */

import React from "react";
import { Metadata } from "next";
import { Header } from "@/components/desk/Header";
import { listProjects, getProjectById, getProjectUnitTypes, getCmaAnalysisForProject } from "@/server/dal/catalog";
import { getDeveloperById } from "@/server/dal/developers";
import { getClusterPipelineAnalysis } from "@/server/dal/pipeline";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
} from "@/domain/exit/exit-scenario-engine";
import { StudioProjectFacts, generateReelsScript } from "@/domain/content/content-studio";
import { ReelsStudioClient } from "@/components/studio/ReelsStudioClient";
import { Video, Sparkles, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dual RU/AR Content Studio — Dubai Off-plan Research Desk",
  description:
    "Generate 45–75 second Reels teleprompter scripts and social media data cards bound to verified DLD metrics.",
};

export default async function StudioPage() {
  const projectsRes = await listProjects({ limit: 100 });
  const initialProjectId = projectsRes.items[0]?.id || "proj_dld_529545309";

  const [project, unitTypes, cmaData, pipelineAnalysis] = await Promise.all([
    getProjectById(initialProjectId),
    getProjectUnitTypes(initialProjectId),
    getCmaAnalysisForProject({ projectId: initialProjectId, bedrooms: 1 }),
    getClusterPipelineAnalysis(initialProjectId),
  ]);

  const developerTrackRecord = project?.developerId
    ? await getDeveloperById(project.developerId)
    : null;

  const unit = unitTypes[0] || {
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
    handoverDateStr: project?.expectedHandoverDate || "2028-12-01",
    holdingYears: 5,
  });

  const flipBreakEvenPsf = Math.round(assignmentResale.breakEvenPsfAED.toNumber());
  const flipBaselineRoiPct = Number(assignmentResale.scenarios[1].cashOnCashRoiPercent.toFixed(1));
  const holdNetYieldPct = Number(holdAnalysis.rentalMetrics.netYieldOnCost.toFixed(2));

  const facts: StudioProjectFacts = {
    projectId: project?.id || initialProjectId,
    dldProjectId: project?.dldProjectId,
    projectNameEn: project?.nameEn || "Avenue Residence 5",
    projectNameAr: project?.nameAr,
    developerBrand: project?.developerBrandName || "Nabni Real Estate",
    developerBrandAr: null,
    areaNameEn: project?.areaNameEn || "Al Furjan",
    areaNameAr: null,
    bedrooms: unit.bedrooms !== null ? unit.bedrooms : 1,
    areaSqft,
    priceAed,
    pricePsfAed: pricePsf,
    handoverDate: project?.expectedHandoverDate || "2028-12-01",
    cmaReadyMedianPsf: cmaData?.cma.readyGroup.medianPsf ? cmaData.cma.readyGroup.medianPsf.toNumber() : null,
    cmaGapReadyPct: cmaData?.cma.gapToReadyPercent ? cmaData.cma.gapToReadyPercent.toNumber() : null,
    cmaSampleStatus: cmaData?.cma.readyGroup.reliability || "INSUFFICIENT",
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

  const projectOptions = projectsRes.items.map((p) => ({
    id: p.id,
    nameEn: p.nameEn,
    developerBrand: p.developerBrand,
    areaName: p.areaNameEn,
    expectedHandoverDate: p.expectedHandoverDate,
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1.5 shadow-2xs">
                <Video className="h-3 w-3 text-sky-600" />
                Section 16 &amp; 18 Compliance
              </span>
              <span className="text-xs text-slate-500 font-mono">
                5-Stage Script Structure &bull; Whitelisted Metric Bindings &bull; Safe Area Overlays
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Dual RU/AR Content &amp; Reels Studio
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Generate 45–75 second Reels scripts and export high-impact 1080x1920 data cards with identical verified figures in Russian and Arabic.
            </p>
          </div>
        </div>

        {/* Client Workspace */}
        <ReelsStudioClient
          projects={projectOptions}
          initialFacts={facts}
          initialScript={dualScript}
        />
      </main>
    </div>
  );
}
