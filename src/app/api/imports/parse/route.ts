import { NextRequest, NextResponse } from "next/server";
import { parseDeveloperOfferBuffer } from "@/domain/imports/offer-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name;

    const result = parseDeveloperOfferBuffer(buffer, fileName);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("Failed to parse developer document:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to parse document" },
      { status: 500 }
    );
  }
}
