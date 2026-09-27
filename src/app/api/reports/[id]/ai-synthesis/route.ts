import { NextRequest, NextResponse } from "next/server";
import { getReportSnapshotById } from "@/server/dal/reports";
import { generateDossierSynthesis } from "@/server/adapters/ai/gemini-adapter";
import { db } from "@/server/db";
import { reportSnapshots } from "@db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const requestedLocale = body.locale || body.language;

    const snapshot = await getReportSnapshotById(id);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const payload = snapshot.payload;
    const project = payload.project || {};
    const unit = payload.unit || {};
    const cma = payload.cma || {};
    const locale = requestedLocale || snapshot.locale || "ru";

    const uPrice = unit.netPriceAed || unit.listPriceAed || 0;
    const uArea = unit.areaSqftMin || unit.areaSqftMax || unit.areaSqft || 850;
    const uPsf = uPrice > 0 && uArea > 0 ? Math.round(uPrice / uArea) : (cma.targetPsf ? Number(cma.targetPsf) : 0);
    const bePsf = payload.financialScenarios?.breakEven?.breakEvenPsfAed || Math.round(uPsf * 1.05);

    const aiSynthesis = await generateDossierSynthesis(
      {
        projectName: project.nameEn || "Project",
        projectNameAr: project.nameAr,
        developerName: project.developerBrandName || payload.developer?.developerName || "Developer",
        areaName: project.areaNameEn || "Dubai",
        bedrooms: unit.bedrooms !== null && unit.bedrooms !== undefined ? unit.bedrooms : 1,
        unitPriceAed: uPrice,
        unitAreaSqft: uArea,
        unitPsf: uPsf,
        expectedHandoverDate: project.expectedHandoverDate || undefined,
        readyMedianPsf: cma.readyGroup?.medianPsf ? Number(cma.readyGroup.medianPsf) : null,
        readyDealsCount: cma.readyGroup?.count || 0,
        gapToReadyPercent: cma.gapToReadyPercent != null ? Number(cma.gapToReadyPercent) : null,
        offPlanMedianPsf: cma.offPlanGroup?.medianPsf ? Number(cma.offPlanGroup.medianPsf) : null,
        offPlanDealsCount: cma.offPlanGroup?.count || 0,
        gapToOffPlanPercent: cma.gapToOffPlanPercent != null ? Number(cma.gapToOffPlanPercent) : null,
        nearHandoverMedianPsf: cma.nearHandoverGroup?.medianPsf ? Number(cma.nearHandoverGroup.medianPsf) : null,
        nearHandoverDealsCount: cma.nearHandoverGroup?.count || 0,
        nocThresholdPercent: unit.minPaidPctForNoc || 34,
        breakEvenPsfAed: bePsf,
        flipRoiPct: payload.financialScenarios?.flipExit?.cashOnCashRoiPct || 10,
        holdYieldPct: payload.financialScenarios?.holdExit?.netYieldOnTotalCostPct || 7.5,
        competingCollisionCount: payload.pipeline?.collisionWindowProjectsCount || 0,
        developerAvgDelayDays: payload.developer?.averageDelayDays ? Number(payload.developer.averageDelayDays) : null,
      },
      locale === "ar" ? "ar" : locale === "en" ? "en" : "ru"
    );

    // Update in database snapshot payload
    const updatedPayload = {
      ...payload,
      aiSynthesis,
    };

    await db
      .update(reportSnapshots)
      .set({
        payloadJson: JSON.stringify(updatedPayload),
      })
      .where(eq(reportSnapshots.id, id));

    return NextResponse.json({
      success: true,
      aiSynthesis,
    });
  } catch (err: any) {
    console.error("AI synthesis error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI synthesis" },
      { status: 500 }
    );
  }
}
