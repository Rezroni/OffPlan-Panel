import { NextRequest, NextResponse } from "next/server";
import { generateReportPdf } from "@/server/export/pdf-generator";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const exportPath = path.join(process.cwd(), "public", "exports", "reports", `${id}.pdf`);

    let pdfBuffer: Buffer;

    if (fs.existsSync(exportPath)) {
      pdfBuffer = fs.readFileSync(exportPath);
    } else {
      const origin = req.nextUrl.origin;
      const res = await generateReportPdf({
        snapshotId: id,
        baseUrl: origin,
      });
      pdfBuffer = res.pdfBuffer;
    }

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="OffPlan-Dossier-${id}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
