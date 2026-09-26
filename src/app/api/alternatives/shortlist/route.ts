import { NextRequest, NextResponse } from "next/server";
import { getAlternativesShortlistForClient } from "@/server/dal/catalog";
import { ClientBriefParams, ClientStrategy } from "@/domain/alternatives/shortlist";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const brief: ClientBriefParams = {
      budgetAed: body.budgetAed || 1800000,
      targetBedrooms: body.targetBedrooms || [1],
      preferredAreaId: body.preferredAreaId,
      preferredAreaName: body.preferredAreaName || "Business Bay",
      targetStrategy: (body.targetStrategy as ClientStrategy) || "flip",
      maxHandoverYear: body.maxHandoverYear || 2027,
    };

    const withAiCommentary = Boolean(body.withAiCommentary ?? true);

    const result = await getAlternativesShortlistForClient({
      brief,
      withAiCommentary,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Shortlist API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
