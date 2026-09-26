import { NextRequest, NextResponse } from "next/server";
import { saveOfferRevision } from "@/server/dal/imports";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      buildingId,
      fileName,
      fileChecksum,
      fileSizeBytes,
      sheetName,
      receivedAt,
      confirmedBy,
      notes,
      units,
    } = body;

    if (!projectId || !fileName || !fileChecksum || !Array.isArray(units)) {
      return NextResponse.json(
        { error: "Missing required revision parameters" },
        { status: 400 }
      );
    }

    const result = await saveOfferRevision({
      projectId,
      buildingId,
      fileName,
      fileChecksum,
      fileSizeBytes: fileSizeBytes || 0,
      sheetName,
      receivedAt: receivedAt || new Date().toISOString(),
      confirmedBy: confirmedBy || "agent:Mokhamed",
      notes,
      units,
    });

    return NextResponse.json({
      success: true,
      revisionId: result.revisionId,
      unitsSaved: result.unitsSaved,
    });
  } catch (err: any) {
    console.error("Failed to confirm offer revision:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to confirm revision" },
      { status: 500 }
    );
  }
}
