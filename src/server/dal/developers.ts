/**
 * Data Access Layer — Developers & Construction Track Record (§13)
 * Server-side only. Never import directly in client components.
 */

import { db } from "@/server/db";
import { developers, projects } from "@db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import {
  buildDeveloperTrackRecord,
  DeveloperProjectFact,
  DeveloperTrackRecordSummary,
} from "@/domain/developer/developer-track-record";

export interface DeveloperListItem {
  id: string;
  legalName: string;
  brandName: string | null;
  displayName: string;
  dldDeveloperId: string | null;
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
  reliabilityBadge: "PROVEN_DISCIPLINE" | "MODERATE_DELAYS" | "CHRONIC_DELAYS" | "INSUFFICIENT_HISTORY";
  avgDelayMonths: number;
  onTimeRatePercent: number;
}

/**
 * Resolves a clean, professional, non-empty display name for a developer.
 * Strips isolated brackets, dots, and fallbacks cleanly.
 */
export function getDeveloperDisplayName(dev: {
  brandName?: string | null;
  legalName?: string | null;
  dldDeveloperId?: string | null;
  id?: string;
}): string {
  const clean = (s?: string | null) =>
    (s || "")
      .replace(/[\(\[\{]\s*[\.\s\-_]*[\)\]\}]/g, "")
      .replace(/\.{2,}/g, "")
      .trim();

  const brand = clean(dev.brandName);
  const legal = clean(dev.legalName);

  if (brand && brand.length >= 2) return brand;
  if (legal && legal.length >= 2) return legal;

  const numId = dev.dldDeveloperId || dev.id?.replace(/^dev_/, "");
  return numId ? `Developer #${numId}` : "Dubai Master Developer";
}

export async function listDevelopers(): Promise<DeveloperListItem[]> {
  const allDevs = await db.select().from(developers);
  const allProjects = await db.select().from(projects);

  const projectsByDev = new Map<string, typeof allProjects>();
  for (const p of allProjects) {
    if (!p.developerId) continue;
    if (!projectsByDev.has(p.developerId)) {
      projectsByDev.set(p.developerId, []);
    }
    projectsByDev.get(p.developerId)!.push(p);
  }

  const list: DeveloperListItem[] = allDevs.map((dev) => {
    const devProjects = projectsByDev.get(dev.id) || [];
    const facts: DeveloperProjectFact[] = devProjects.map((p) => ({
      projectId: p.id,
      projectName: p.nameEn,
      status: (p.status as any) || "active",
      originalPromisedDate: p.expectedHandoverDate,
      actualHandoverDate: p.status === "completed" ? p.expectedHandoverDate : null,
      currentExpectedDate: p.expectedHandoverDate,
      constructionProgressPct: p.constructionProgressPct,
      escrowStatus: p.escrowStatus,
      escrowBankName: p.escrowBankName,
      totalUnitsReported: p.totalUnitsReported,
    }));

    const displayName = getDeveloperDisplayName(dev);
    const trackRecord = buildDeveloperTrackRecord(dev.id, dev.legalName, dev.brandName || displayName, facts);

    return {
      id: dev.id,
      legalName: dev.legalName || displayName,
      brandName: dev.brandName || displayName,
      displayName,
      dldDeveloperId: dev.dldDeveloperId,
      totalProjects: trackRecord.totalProjects,
      completedProjects: trackRecord.completedProjectsCount,
      activeProjects: trackRecord.activeProjectsCount,
      reliabilityBadge: trackRecord.reliabilityRatingBadge,
      avgDelayMonths: Number(trackRecord.averageDelayMonths.toFixed(1)),
      onTimeRatePercent: Number(trackRecord.onTimeDeliveryRatePercent.toFixed(0)),
    };
  });

  // Sort: Developers with projects first (most projects to least), then alphabetical by display name
  list.sort((a, b) => {
    if (b.totalProjects !== a.totalProjects) {
      return b.totalProjects - a.totalProjects;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return list;
}

export async function getDeveloperById(id: string): Promise<{
  developer: typeof developers.$inferSelect & { displayName: string };
  trackRecord: DeveloperTrackRecordSummary;
} | null> {
  const [dev] = await db.select().from(developers).where(eq(developers.id, id)).limit(1);
  if (!dev) return null;

  const devProjects = await db.select().from(projects).where(eq(projects.developerId, id));

  const facts: DeveloperProjectFact[] = devProjects.map((p) => ({
    projectId: p.id,
    projectName: p.nameEn,
    status: (p.status as any) || "active",
    originalPromisedDate: p.expectedHandoverDate,
    actualHandoverDate: p.status === "completed" ? p.expectedHandoverDate : null,
    currentExpectedDate: p.expectedHandoverDate,
    constructionProgressPct: p.constructionProgressPct,
    escrowStatus: p.escrowStatus,
    escrowBankName: p.escrowBankName,
    totalUnitsReported: p.totalUnitsReported,
  }));

  const displayName = getDeveloperDisplayName(dev);
  const trackRecord = buildDeveloperTrackRecord(dev.id, dev.legalName, dev.brandName || displayName, facts);

  return {
    developer: {
      ...dev,
      displayName,
    },
    trackRecord,
  };
}
