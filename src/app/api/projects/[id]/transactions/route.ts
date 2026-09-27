import { NextRequest, NextResponse } from "next/server";
import { getProjectRecentTransactions } from "@/server/dal/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const bedroomsParam = url.searchParams.get("bedrooms");
    const limitParam = url.searchParams.get("limit");

    const bedrooms = bedroomsParam !== null ? parseInt(bedroomsParam, 10) : 1;
    const limit = limitParam !== null ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 5;

    if (isNaN(bedrooms)) {
      return NextResponse.json({ error: "Invalid bedrooms parameter" }, { status: 400 });
    }

    const result = await getProjectRecentTransactions({
      projectId: id,
      bedrooms,
      limit,
    });

    return NextResponse.json({
      success: true,
      projectId: id,
      bedrooms,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching project recent transactions:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
