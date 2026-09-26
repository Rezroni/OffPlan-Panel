import { Decimal, toDecimal } from "@/lib/decimal";

export interface DeveloperProjectFact {
  projectId: string;
  projectName: string;
  status: "completed" | "active" | "suspended" | "unknown";
  originalPromisedDate: string | null; // ISO 'YYYY-MM-DD'
  actualHandoverDate: string | null; // ISO 'YYYY-MM-DD'
  currentExpectedDate?: string | null; // ISO 'YYYY-MM-DD'
  constructionProgressPct?: number | null; // 0-100
  escrowStatus?: string | null; // "verified_active" | "reported" | "unknown"
  escrowBankName?: string | null;
  totalUnitsReported?: number | null;
}

export interface DeveloperTrackRecordSummary {
  developerId: string;
  legalName: string;
  brandName?: string | null;
  totalProjects: number;
  completedProjectsCount: number;
  activeProjectsCount: number;
  projectsWithHandoverData: number;
  coverageRatioPercent: Decimal; // (projectsWithHandoverData / completedProjectsCount) * 100
  onTimeDeliveryRatePercent: Decimal; // % of completed delivered on or before promised date
  delayedProjectsCount: number;
  earlyOrOnTimeCount: number;
  averageDelayDays: Decimal;
  averageDelayMonths: Decimal;
  medianDelayMonths: Decimal;
  maxDelayMonths: Decimal;
  overdueActiveCount: number; // Active projects currently past promised date
  reliabilityRatingBadge: "PROVEN_DISCIPLINE" | "MODERATE_DELAYS" | "CHRONIC_DELAYS" | "INSUFFICIENT_HISTORY";
  reliabilityNotes: string;
  projectHistory: Array<{
    projectId: string;
    projectName: string;
    status: string;
    originalPromisedDate: string | null;
    actualHandoverDate: string | null;
    delayDays: number | null;
    delayMonths: number | null;
    isDelayed: boolean;
    escrowStatus: string;
    escrowBankName: string | null;
    constructionProgressPct: number | null;
  }>;
}

/**
 * Builds developer track record analysis per Section 13 & 27:
 * - late_days = max(0, actual_handover - original_promised_date)
 * - Computes on-time rate, average/median delay, overdue active pipeline, and escrow governance.
 */
export function buildDeveloperTrackRecord(
  developerId: string,
  legalName: string,
  brandName: string | null,
  projectsList: DeveloperProjectFact[],
  asOfDateStr = "2026-09-24"
): DeveloperTrackRecordSummary {
  const asOfDate = new Date(asOfDateStr).getTime();
  let completedCount = 0;
  let activeCount = 0;
  let overdueActiveCount = 0;

  const validDelays: number[] = []; // delay in days (capped at 0 via max(0, actual - promised))
  const projectHistory: DeveloperTrackRecordSummary["projectHistory"] = [];

  for (const p of projectsList) {
    const isCompleted = p.status === "completed" || Boolean(p.actualHandoverDate);
    if (isCompleted) {
      completedCount++;
    } else if (p.status === "active") {
      activeCount++;
      if (p.originalPromisedDate) {
        const promisedTime = new Date(p.originalPromisedDate).getTime();
        if (asOfDate > promisedTime) {
          overdueActiveCount++;
        }
      }
    }

    let delayDays: number | null = null;
    let delayMonths: number | null = null;
    let isDelayed = false;

    if (p.originalPromisedDate && p.actualHandoverDate) {
      const promisedTime = new Date(p.originalPromisedDate).getTime();
      const actualTime = new Date(p.actualHandoverDate).getTime();
      const diffMs = actualTime - promisedTime;
      const rawDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      // Standard Section 13 specification rule: max(0, actual - promised)
      const lateDays = Math.max(0, rawDays);
      delayDays = lateDays;
      delayMonths = Number((lateDays / 30.416).toFixed(1));
      isDelayed = rawDays > 0;
      validDelays.push(lateDays);
    }

    projectHistory.push({
      projectId: p.projectId,
      projectName: p.projectName,
      status: p.status,
      originalPromisedDate: p.originalPromisedDate,
      actualHandoverDate: p.actualHandoverDate,
      delayDays,
      delayMonths,
      isDelayed,
      escrowStatus: p.escrowStatus || "unknown",
      escrowBankName: p.escrowBankName || null,
      constructionProgressPct: p.constructionProgressPct ?? null,
    });
  }

  const projectsWithData = validDelays.length;
  const coverageRatio = completedCount > 0
    ? new Decimal(projectsWithData).dividedBy(completedCount).times(100)
    : new Decimal(0);

  let avgDelayDays = new Decimal(0);
  let avgDelayMonths = new Decimal(0);
  let medianDelayMonths = new Decimal(0);
  let maxDelayMonths = new Decimal(0);
  let onTimeRate = new Decimal(0);
  let delayedCount = 0;
  let earlyOrOnTime = 0;

  if (projectsWithData > 0) {
    validDelays.sort((a, b) => a - b);
    const sumDays = validDelays.reduce((acc, d) => acc + d, 0);
    avgDelayDays = new Decimal(sumDays).dividedBy(projectsWithData);
    avgDelayMonths = avgDelayDays.dividedBy(30.416);

    const midIdx = Math.floor(projectsWithData / 2);
    const medianDays = projectsWithData % 2 === 0
      ? (validDelays[midIdx - 1] + validDelays[midIdx]) / 2
      : validDelays[midIdx];
    medianDelayMonths = new Decimal(medianDays).dividedBy(30.416);

    const maxDays = validDelays[validDelays.length - 1];
    maxDelayMonths = new Decimal(maxDays).dividedBy(30.416);

    earlyOrOnTime = validDelays.filter((d) => d === 0).length;
    delayedCount = validDelays.filter((d) => d > 0).length;
    onTimeRate = new Decimal(earlyOrOnTime).dividedBy(projectsWithData).times(100);
  }

  // Reliability Badge Assessment
  let badge: DeveloperTrackRecordSummary["reliabilityRatingBadge"] = "INSUFFICIENT_HISTORY";
  let notes = "";

  if (projectsWithData < 2) {
    badge = "INSUFFICIENT_HISTORY";
    notes = `Only ${projectsWithData} completed project(s) with verified promised vs actual handover dates. Track record sample size is insufficient for automated rating.`;
  } else if (onTimeRate.greaterThanOrEqualTo(80) && avgDelayMonths.lessThanOrEqualTo(3)) {
    badge = "PROVEN_DISCIPLINE";
    notes = `High delivery discipline: ${onTimeRate.toFixed(0)}% delivered on schedule. Average delay ${avgDelayMonths.toFixed(1)} months.`;
  } else if (avgDelayMonths.lessThanOrEqualTo(8)) {
    badge = "MODERATE_DELAYS";
    notes = `Moderate execution lag: average delay of ${avgDelayMonths.toFixed(1)} months across completed developments. Stress testing recommended.`;
  } else {
    badge = "CHRONIC_DELAYS";
    notes = `Significant execution delays detected (average ${avgDelayMonths.toFixed(1)} months). Mandatory +12-month delay stress test required for investor solvency gating.`;
  }

  return {
    developerId,
    legalName,
    brandName,
    totalProjects: projectsList.length,
    completedProjectsCount: completedCount,
    activeProjectsCount: activeCount,
    projectsWithHandoverData: projectsWithData,
    coverageRatioPercent: coverageRatio,
    onTimeDeliveryRatePercent: onTimeRate,
    delayedProjectsCount: delayedCount,
    earlyOrOnTimeCount: earlyOrOnTime,
    averageDelayDays: avgDelayDays,
    averageDelayMonths: avgDelayMonths,
    medianDelayMonths: medianDelayMonths,
    maxDelayMonths: maxDelayMonths,
    overdueActiveCount,
    reliabilityRatingBadge: badge,
    reliabilityNotes: notes,
    projectHistory,
  };
}
