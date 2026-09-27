/**
 * Data Access Layer — Competing Supply & Cluster Pipeline (§14)
 * Server-side only.
 */

import { db } from "@/server/db";
import { projects, areas, developers } from "@db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import {
  evaluateCompetingSupply,
  CompetingProjectItem,
  CompetingSupplyAnalysis,
} from "@/domain/pipeline/competing-supply";

export async function getClusterPipelineAnalysis(
  projectId: string
): Promise<CompetingSupplyAnalysis | null> {
  const [target] = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      areaId: projects.areaId,
      expectedHandoverDate: projects.expectedHandoverDate,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!target) return null;

  const targetHandover = target.expectedHandoverDate || "2028-12-01";

  type NearbyProjectRow = {
    id: string;
    nameEn: string;
    expectedHandoverDate: string | null;
    constructionProgressPct: number | null;
    totalUnitsReported: number | null;
    status: string | null;
    areaNameEn: string | null;
    developerLegal: string | null;
    developerBrand: string | null;
  };

  let nearbyRows: NearbyProjectRow[] = [];

  if (target.areaId) {
    nearbyRows = await db
      .select({
        id: projects.id,
        nameEn: projects.nameEn,
        expectedHandoverDate: projects.expectedHandoverDate,
        constructionProgressPct: projects.constructionProgressPct,
        totalUnitsReported: projects.totalUnitsReported,
        status: projects.status,
        areaNameEn: areas.nameEn,
        developerLegal: developers.legalName,
        developerBrand: developers.brandName,
      })
      .from(projects)
      .leftJoin(areas, eq(projects.areaId, areas.id))
      .leftJoin(developers, eq(projects.developerId, developers.id))
      .where(and(eq(projects.areaId, target.areaId), ne(projects.id, target.id)));
  }

  // If area has few projects, fallback to any active off-plan developments in catalog
  if (nearbyRows.length < 3) {
    const extraRows = await db
      .select({
        id: projects.id,
        nameEn: projects.nameEn,
        expectedHandoverDate: projects.expectedHandoverDate,
        constructionProgressPct: projects.constructionProgressPct,
        totalUnitsReported: projects.totalUnitsReported,
        status: projects.status,
        areaNameEn: areas.nameEn,
        developerLegal: developers.legalName,
        developerBrand: developers.brandName,
      })
      .from(projects)
      .leftJoin(areas, eq(projects.areaId, areas.id))
      .leftJoin(developers, eq(projects.developerId, developers.id))
      .where(ne(projects.id, target.id))
      .limit(20);

    const existingIds = new Set(nearbyRows.map((r) => r.id));
    for (const r of extraRows) {
      if (!existingIds.has(r.id)) {
        nearbyRows.push(r);
      }
    }
  }

  const items: CompetingProjectItem[] = nearbyRows.map((r) => ({
    id: r.id,
    nameEn: r.nameEn,
    areaNameEn: r.areaNameEn,
    developerName: r.developerBrand || r.developerLegal || "Dubai Developer",
    expectedHandoverDate: r.expectedHandoverDate,
    constructionProgressPct: r.constructionProgressPct,
    totalUnitsReported: r.totalUnitsReported,
    status: r.status || "active",
  }));

  return evaluateCompetingSupply(target.id, targetHandover, items);
}
