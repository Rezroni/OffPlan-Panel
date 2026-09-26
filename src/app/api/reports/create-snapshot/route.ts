import { NextRequest, NextResponse } from "next/server";
import { createReportSnapshot } from "@/server/dal/reports";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, unitTypeId, locale = "ru", title } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing required projectId" }, { status: 400 });
    }

    const result = await createReportSnapshot({
      projectId,
      unitTypeId,
      locale: locale === "ar" ? "ar" : locale === "en" ? "en" : "ru",
      title,
      generatedBy: "Mokhamed",
    });

    return NextResponse.json({
      success: true,
      snapshotId: result.snapshotId,
      snapshotHash: result.snapshotHash,
    });
  } catch (error: any) {
    console.error("Create report snapshot error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
