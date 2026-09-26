import { NextRequest, NextResponse } from "next/server";
import { getCmaAnalysisForProject } from "@/server/dal/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(req.url);

    const bedrooms = searchParams.get("bedrooms")
      ? parseInt(searchParams.get("bedrooms")!, 10)
      : 1;
    const customPrice = searchParams.get("price")
      ? parseInt(searchParams.get("price")!, 10)
      : undefined;
    const customArea = searchParams.get("area")
      ? parseFloat(searchParams.get("area")!)
      : undefined;
    const months = searchParams.get("months")
      ? parseInt(searchParams.get("months")!, 10)
      : 12;

    const data = await getCmaAnalysisForProject({
      projectId,
      bedrooms,
      customTargetPriceAed: customPrice,
      customTargetAreaSqft: customArea,
      monthsWindow: months,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("CMA API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
