import { NextRequest, NextResponse } from "next/server";
import { getProjectResaleChains } from "@/server/dal/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const bedroomsParam = url.searchParams.get("bedrooms");
    const minConfidenceParam = url.searchParams.get("minConfidence");

    const bedrooms = bedroomsParam !== null && bedroomsParam !== "" ? parseInt(bedroomsParam, 10) : undefined;
    const minConfidence = minConfidenceParam !== null ? parseInt(minConfidenceParam, 10) : 90;

    const result = await getProjectResaleChains({
      projectId: id,
      bedrooms: bedrooms !== undefined && !isNaN(bedrooms) ? bedrooms : undefined,
      minConfidence: !isNaN(minConfidence) ? minConfidence : 90,
    });

    return NextResponse.json({
      success: true,
      projectId: id,
      bedrooms: bedrooms ?? null,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching project resale chains:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
