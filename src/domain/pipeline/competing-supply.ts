import { Decimal, toDecimal } from "@/lib/decimal";

export interface CompetingProjectItem {
  id: string;
  nameEn: string;
  areaNameEn?: string | null;
  developerName?: string | null;
  expectedHandoverDate: string | null; // ISO 'YYYY-MM-DD'
  constructionProgressPct: number | null;
  totalUnitsReported: number | null;
  averagePsfAed?: number | null;
  status: string;
}

export interface QuarterSupplyBucket {
  quarter: string; // e.g. "2027-Q2"
  projectsCount: number;
  totalUnits: number;
  isCollisionWindow: boolean;
  isTargetQuarter?: boolean;
  isHistorical?: boolean;
  projects: Array<{
    id: string;
    nameEn: string;
    progressPct: number | null;
    units: number | null;
    developerName?: string | null;
    status?: string | null;
  }>;
}

export interface CompetingCollisionItem {
  id: string;
  nameEn: string;
  developerName: string | null;
  expectedHandoverDate: string | null;
  quarter: string;
  constructionProgressPct: number | null;
  totalUnitsReported: number | null;
  status: string;
  monthsDifference: number; // e.g. -2, 0, +3 months
  delayRiskRating: "ON_TRACK" | "AT_RISK" | "HIGH_DELAY_RISK";
}

export interface CompetingSupplyAnalysis {
  targetProjectId: string;
  targetHandoverDate: string;
  targetQuarter: string;
  totalNearbyProjects: number;
  totalKnownUnitsInPipeline: number;
  collisionWindowProjectsCount: number;
  collisionWindowUnitsCount: number;
  supplyPressureRisk: "LOW_PRESSURE" | "MODERATE_PRESSURE" | "HIGH_COLLISION_RISK";
  supplyNotes: string;
  quarterlyTimeline: QuarterSupplyBucket[];
  // Rich analytical fields for investor decisions
  collisionProjects: CompetingCollisionItem[];
  historicalUnitsDelivered: number;
  futurePipelineUnits: number;
  futureProjectsCount: number;
  peakQuarter: string | null;
  peakQuarterUnits: number;
  absorptionMonthsEstimate: number;
  resaleCompetitionScore: "LOW" | "MODERATE" | "HIGH";
  rentalCompressionScore: "LOW" | "MODERATE" | "HIGH";
}

/**
 * Converts ISO date to quarter string e.g. "2027-Q3"
 */
export function getYearQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/**
 * Evaluates competing supply and handover collisions in the surrounding cluster (Section 14):
 * - Identifies projects delivering within +/- 6 months of target handover date
 * - Evaluates potential market absorption drag and rental saturation risk
 */
export function evaluateCompetingSupply(
  targetProjectId: string,
  targetHandoverDateStr: string,
  nearbyProjects: CompetingProjectItem[]
): CompetingSupplyAnalysis {
  const targetDate = new Date(targetHandoverDateStr).getTime();
  const targetQuarter = getYearQuarter(targetHandoverDateStr);

  const sixMonthsMs = 183 * 24 * 60 * 60 * 1000;
  const collisionStart = targetDate - sixMonthsMs;
  const collisionEnd = targetDate + sixMonthsMs;

  let totalPipelineUnits = 0;
  let collisionProjects = 0;
  let collisionUnits = 0;
  let historicalUnits = 0;
  let futureUnits = 0;
  let futureCount = 0;

  const bucketsMap = new Map<string, QuarterSupplyBucket>();
  const collisionList: CompetingCollisionItem[] = [];

  for (const p of nearbyProjects) {
    if (p.id === targetProjectId) continue; // skip target itself

    const units = p.totalUnitsReported || 0;
    totalPipelineUnits += units;

    let isCollision = false;
    let quarter = "Unspecified";
    let isHistorical = false;

    if (p.expectedHandoverDate) {
      const pDate = new Date(p.expectedHandoverDate).getTime();
      quarter = getYearQuarter(p.expectedHandoverDate);
      isHistorical = quarter.localeCompare("2025-Q1") < 0 || p.status === "completed";

      if (isHistorical) {
        historicalUnits += units;
      } else {
        futureUnits += units;
        futureCount++;
      }

      if (pDate >= collisionStart && pDate <= collisionEnd) {
        isCollision = true;
        collisionProjects++;
        collisionUnits += units;

        const monthsDiff = Math.round((pDate - targetDate) / (30.44 * 24 * 3600 * 1000));
        
        // Delay risk heuristic: based on progress vs time
        let delayRisk: "ON_TRACK" | "AT_RISK" | "HIGH_DELAY_RISK" = "ON_TRACK";
        const progress = p.constructionProgressPct ?? 0;
        if (progress < 25) {
          delayRisk = "HIGH_DELAY_RISK";
        } else if (progress < 50) {
          delayRisk = "AT_RISK";
        }

        collisionList.push({
          id: p.id,
          nameEn: p.nameEn,
          developerName: p.developerName || null,
          expectedHandoverDate: p.expectedHandoverDate,
          quarter,
          constructionProgressPct: p.constructionProgressPct,
          totalUnitsReported: p.totalUnitsReported,
          status: p.status,
          monthsDifference: monthsDiff,
          delayRiskRating: delayRisk,
        });
      }
    }

    if (!bucketsMap.has(quarter)) {
      bucketsMap.set(quarter, {
        quarter,
        projectsCount: 0,
        totalUnits: 0,
        isCollisionWindow: isCollision,
        isTargetQuarter: quarter === targetQuarter,
        isHistorical,
        projects: [],
      });
    }

    const bucket = bucketsMap.get(quarter)!;
    bucket.projectsCount++;
    bucket.totalUnits += units;
    if (isCollision) bucket.isCollisionWindow = true;
    if (quarter === targetQuarter) bucket.isTargetQuarter = true;
    bucket.projects.push({
      id: p.id,
      nameEn: p.nameEn,
      progressPct: p.constructionProgressPct,
      units: p.totalUnitsReported,
      developerName: p.developerName,
      status: p.status,
    });
  }

  // Sort quarters chronologically
  const quarterlyTimeline = Array.from(bucketsMap.values()).sort((a, b) => {
    if (a.quarter === "Unspecified") return 1;
    if (b.quarter === "Unspecified") return -1;
    return a.quarter.localeCompare(b.quarter);
  });

  // Find peak future quarter
  let peakQuarter: string | null = null;
  let peakUnits = 0;
  for (const b of quarterlyTimeline) {
    if (!b.isHistorical && b.quarter !== "Unspecified" && b.totalUnits > peakUnits) {
      peakUnits = b.totalUnits;
      peakQuarter = b.quarter;
    }
  }

  // Sort collision projects by handover date
  collisionList.sort((a, b) => (a.expectedHandoverDate || "").localeCompare(b.expectedHandoverDate || ""));

  // Risk rating
  let risk: CompetingSupplyAnalysis["supplyPressureRisk"] = "LOW_PRESSURE";
  let notes = "";

  if (collisionProjects >= 5 || collisionUnits >= 1500) {
    risk = "HIGH_COLLISION_RISK";
    notes = `High delivery concentration: ${collisionProjects} neighboring developments (~${collisionUnits.toLocaleString()} units) completing within ±6 months of target. Expect elevated secondary market competition and initial rental absorption period of 3-6 months.`;
  } else if (collisionProjects >= 2 || collisionUnits >= 500) {
    risk = "MODERATE_PRESSURE";
    notes = `Moderate pipeline: ${collisionProjects} projects (~${collisionUnits.toLocaleString()} units) delivering in the target window. Balanced absorption expected.`;
  } else {
    risk = "LOW_PRESSURE";
    notes = `Favorable supply dynamics: only ${collisionProjects} competing handover(s) in the target delivery window. Minimal direct handover collision.`;
  }

  // Absorption and score estimates (assuming ~150 units/quarter average absorption in prime cluster)
  const absorptionMonths = Math.max(1, Math.min(12, Math.round((collisionUnits / 150) * 3)));
  const resaleCompetitionScore: "LOW" | "MODERATE" | "HIGH" =
    collisionUnits >= 1000 ? "HIGH" : collisionUnits >= 350 ? "MODERATE" : "LOW";
  const rentalCompressionScore: "LOW" | "MODERATE" | "HIGH" =
    collisionUnits >= 1200 ? "HIGH" : collisionUnits >= 400 ? "MODERATE" : "LOW";

  return {
    targetProjectId,
    targetHandoverDate: targetHandoverDateStr,
    targetQuarter,
    totalNearbyProjects: nearbyProjects.length,
    totalKnownUnitsInPipeline: totalPipelineUnits,
    collisionWindowProjectsCount: collisionProjects,
    collisionWindowUnitsCount: collisionUnits,
    supplyPressureRisk: risk,
    supplyNotes: notes,
    quarterlyTimeline,
    collisionProjects: collisionList,
    historicalUnitsDelivered: historicalUnits,
    futurePipelineUnits: futureUnits,
    futureProjectsCount: futureCount,
    peakQuarter,
    peakQuarterUnits: peakUnits,
    absorptionMonthsEstimate: absorptionMonths,
    resaleCompetitionScore,
    rentalCompressionScore,
  };
}
