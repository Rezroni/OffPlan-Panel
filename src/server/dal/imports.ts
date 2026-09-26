/**
 * Data Access Layer — Developer Document Imports & Offer Revisions (§10.2)
 * Server-side only.
 */

import { db } from "@/server/db";
import { offerRevisions, developerOffers, projects } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { checkOfferFreshness, ParsedDeveloperOfferRow } from "@/domain/imports/offer-parser";

export interface SaveRevisionInput {
  projectId: string;
  buildingId?: string;
  fileName: string;
  fileChecksum: string;
  fileSizeBytes: number;
  sheetName?: string;
  receivedAt: string; // ISO date
  confirmedBy: string; // "agent:Mokhamed"
  notes?: string;
  units: ParsedDeveloperOfferRow[];
}

export async function saveOfferRevision(input: SaveRevisionInput): Promise<{
  revisionId: string;
  unitsSaved: number;
}> {
  const revisionId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Determine latest revision number for this project
  const existing = await db
    .select({ revisionNo: offerRevisions.revisionNo })
    .from(offerRevisions)
    .where(eq(offerRevisions.projectId, input.projectId))
    .orderBy(desc(offerRevisions.revisionNo))
    .limit(1);

  const nextRevisionNo = existing.length > 0 ? existing[0].revisionNo + 1 : 1;
  const availableCount = input.units.filter((u) => u.availability === "available").length;

  // Insert revision header
  await db.insert(offerRevisions).values({
    id: revisionId,
    projectId: input.projectId,
    buildingId: input.buildingId || null,
    fileName: input.fileName,
    fileChecksum: input.fileChecksum,
    fileSizeBytes: input.fileSizeBytes,
    sheetName: input.sheetName || null,
    receivedAt: input.receivedAt,
    confirmedAt: new Date().toISOString(),
    confirmedBy: input.confirmedBy,
    revisionNo: nextRevisionNo,
    totalUnitsParsed: input.units.length,
    totalUnitsAvailable: availableCount,
    status: "confirmed",
    notes: input.notes || null,
  });

  // Batch insert units
  if (input.units.length > 0) {
    const offerRows = input.units.map((u, idx) => ({
      id: `off-${revisionId}-${idx + 1}`,
      revisionId,
      projectId: input.projectId,
      unitNo: u.unitNo,
      floorNo: u.floorNo,
      bedrooms: u.bedrooms,
      unitType: u.unitType,
      view: u.view,
      suiteAreaSqft: u.suiteAreaSqft,
      balconyAreaSqft: u.balconyAreaSqft,
      totalAreaSqft: u.totalAreaSqft,
      listPriceAed: u.listPriceAed,
      discountAed: u.discountAed,
      netPriceAed: u.netPriceAed,
      paymentPlanPreset: u.paymentPlanPreset,
      availability: u.availability,
    }));

    await db.insert(developerOffers).values(offerRows);
  }

  return {
    revisionId,
    unitsSaved: input.units.length,
  };
}

export async function listProjectRevisions(projectId: string) {
  const revs = await db
    .select()
    .from(offerRevisions)
    .where(eq(offerRevisions.projectId, projectId))
    .orderBy(desc(offerRevisions.revisionNo));

  return revs.map((r) => {
    const freshness = checkOfferFreshness(r.receivedAt);
    return {
      ...r,
      isFresh: freshness.isFresh,
      ageHours: freshness.ageHours,
      freshnessWarning: freshness.warningNote,
    };
  });
}

export async function listRecentRevisions(limit = 20) {
  const revs = await db
    .select()
    .from(offerRevisions)
    .orderBy(desc(offerRevisions.confirmedAt))
    .limit(limit);

  return revs.map((r) => {
    const freshness = checkOfferFreshness(r.receivedAt);
    return {
      ...r,
      isFresh: freshness.isFresh,
      ageHours: freshness.ageHours,
      freshnessWarning: freshness.warningNote,
    };
  });
}
