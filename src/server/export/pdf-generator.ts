/**
 * Playwright Automated PDF Generator (§16, §17, §19)
 * Server-side Headless Chromium rendering in crisp A4 print layout.
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { db } from "@/server/db";
import { reportSnapshots } from "@db/schema";
import { eq } from "drizzle-orm";
import { getReportSnapshotById } from "@/server/dal/reports";

export interface GeneratePdfOptions {
  snapshotId: string;
  baseUrl?: string;
}

export async function generateReportPdf(options: GeneratePdfOptions): Promise<{
  pdfBuffer: Buffer;
  filePath: string;
  sizeBytes: number;
}> {
  const snapshot = await getReportSnapshotById(options.snapshotId);
  if (!snapshot) {
    throw new Error(`Report snapshot ${options.snapshotId} not found`);
  }

  const exportDir = path.join(process.cwd(), "public", "exports", "reports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const pdfFileName = `${options.snapshotId}.pdf`;
  const pdfFilePath = path.join(exportDir, pdfFileName);

  const baseUrl = options.baseUrl || process.env.NEXTAUTH_URL || "http://127.0.0.1:3000";
  const targetUrl = `${baseUrl}/reports/${options.snapshotId}?print=true`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 },
      deviceScaleFactor: 2, // High-DPI print quality
    });

    // Navigate to dedicated report preview page
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Emulate print media queries
    await page.emulateMedia({ media: "print" });

    // Generate high-precision A4 PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "14mm",
        bottom: "14mm",
        left: "12mm",
        right: "12mm",
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
          <span style="font-weight: 600; color: #475569;">DUBAI OFF-PLAN RESEARCH DESK</span>
          <span>EVIDENCE-BASED ADVISORY DOSSIER &bull; ${snapshot.snapshotHash.slice(0, 10).toUpperCase()}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
          <span>Agent: ${snapshot.payload.metadata?.agentName || "Mokhamed"} &bull; Verified DLD Data</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    // Write file to disk
    fs.writeFileSync(pdfFilePath, pdfBuffer);
    const sizeBytes = pdfBuffer.length;

    // Update database record
    await db
      .update(reportSnapshots)
      .set({
        pdfPath: `/exports/reports/${pdfFileName}`,
        pdfSizeBytes: sizeBytes,
        status: "exported",
      })
      .where(eq(reportSnapshots.id, options.snapshotId));

    return {
      pdfBuffer,
      filePath: pdfFilePath,
      sizeBytes,
    };
  } finally {
    await browser.close();
  }
}

export async function generatePdfForReportSnapshot(snapshotId: string): Promise<Buffer> {
  const result = await generateReportPdf({ snapshotId });
  return result.pdfBuffer;
}
