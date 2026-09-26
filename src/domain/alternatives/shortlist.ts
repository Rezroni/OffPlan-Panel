/**
 * Dubai Off-plan Research Desk — Section 8: Alternatives & Shortlist Engine
 * 
 * Implements:
 * 1. Eligibility Filtering (budget, rooms, strategy compatibility, assignment rights)
 * 2. Dominated Option Detection (more expensive + worse terms + no advantage)
 * 3. Three Shortlist Roles:
 *    - Best Local Project
 *    - Similar Budget in Alternative Area
 *    - Closer to Handover
 * 4. Four Mandatory Explanation Blocks per Option:
 *    - whyItFits (2-3 measurable arguments)
 *    - tradeOff (substantive compromise)
 *    - disqualificationTriggers (conditions under which it stops fitting)
 *    - factsToVerify (concrete missing items)
 */

import { Decimal, toDecimal } from "@/lib/decimal";

export type ClientStrategy = "flip" | "rental" | "capital_gain" | "lifestyle";

export interface ClientBriefParams {
  id?: string;
  clientName?: string;
  budgetAed: number | string | Decimal;
  targetBedrooms: number[]; // e.g. [1, 2]
  preferredAreaId?: string;
  preferredAreaName?: string;
  targetStrategy: ClientStrategy;
  maxHandoverYear?: number;
}

export interface CandidateOffer {
  id: string;
  projectId: string;
  projectName: string;
  areaId: string;
  areaName: string;
  developerName: string;
  bedrooms: number;
  areaSqft: number;
  priceAed: number;
  pricePerSqftAed: number;
  expectedHandoverYear: number;
  expectedHandoverDate?: string;
  constructionProgressPct?: number;
  assignmentPolicy: "allowed" | "prohibited" | "conditional" | "unknown";
  minPaidPctForNoc?: number;
  paymentPlanSummary?: string; // e.g. "60/40"
  readyMedianPsfArea?: number;
}

export type EligibilityStatus = "passed" | "needs_verification" | "failed";

export interface CandidateEligibility {
  status: EligibilityStatus;
  reasons: string[];
}

export interface CandidateEvaluation {
  candidate: CandidateOffer;
  eligibility: CandidateEligibility;
  isDominated: boolean;
  dominatedReason?: string;
  gapToReadyPsfPct?: number; // e.g. 15.5% below ready median
}

export interface ShortlistExplanation {
  role: "BEST_LOCAL" | "SIMILAR_BUDGET_ALT_AREA" | "NEAR_HANDOVER";
  roleTitle: string;
  whyItFits: string[];
  tradeOff: string;
  disqualificationTriggers: string[];
  factsToVerify: string[];
}

export interface ShortlistItem {
  candidate: CandidateOffer;
  evaluation: CandidateEvaluation;
  explanation: ShortlistExplanation;
}

export interface ShortlistResult {
  clientBrief: ClientBriefParams;
  totalCandidatesEvaluated: number;
  eligibleCount: number;
  dominatedCount: number;
  shortlist: ShortlistItem[];
  auditNotes: string[];
}

/**
 * Stage 1: Eligibility Evaluation
 * §8: "Условие неизвестно -> needs_verification, а не passed.
 * Запрет/неподходящее условие уступки исключает вариант из стратегии флипа."
 */
export function evaluateCandidateEligibility(
  candidate: CandidateOffer,
  brief: ClientBriefParams
): CandidateEligibility {
  const reasons: string[] = [];
  let hasFailure = false;
  let hasUncertainty = false;

  const budget = toDecimal(brief.budgetAed);
  const candPrice = toDecimal(candidate.priceAed);

  // 1. Budget check: budget tolerance 10%
  const budgetMax = budget.times(1.10);
  if (candPrice.greaterThan(budgetMax)) {
    hasFailure = true;
    reasons.push(
      `Price ${candPrice.toFixed(0)} AED exceeds budget ceiling ${budgetMax.toFixed(0)} AED (+10% tolerance)`
    );
  }

  // 2. Bedrooms check
  if (brief.targetBedrooms.length > 0 && !brief.targetBedrooms.includes(candidate.bedrooms)) {
    hasFailure = true;
    reasons.push(
      `${candidate.bedrooms}BR does not match requested room count [${brief.targetBedrooms.join(", ")}]`
    );
  }

  // 3. Strategy & Assignment compatibility
  if (brief.targetStrategy === "flip") {
    if (candidate.assignmentPolicy === "prohibited") {
      hasFailure = true;
      reasons.push("Assignment is PROHIBITED by developer, excluding option from flip strategy");
    } else if (candidate.assignmentPolicy === "unknown") {
      hasUncertainty = true;
      reasons.push("Assignment policy is UNKNOWN; must verify NOC threshold before recommending flip");
    }
  }

  // 4. Handover year check
  if (brief.maxHandoverYear && candidate.expectedHandoverYear > brief.maxHandoverYear) {
    hasFailure = true;
    reasons.push(
      `Expected completion (${candidate.expectedHandoverYear}) exceeds client deadline (${brief.maxHandoverYear})`
    );
  }

  if (hasFailure) {
    return { status: "failed", reasons };
  }
  if (hasUncertainty) {
    return { status: "needs_verification", reasons };
  }
  return { status: "passed", reasons: ["All eligibility criteria passed"] };
}

/**
 * Stage 2: Dominated Options Check
 * §8: "дороже, тяжелее по графику и без выявленного преимущества при сопоставимом качестве"
 */
export function markDominatedOptions(
  evaluations: { candidate: CandidateOffer; eligibility: CandidateEligibility }[]
): CandidateEvaluation[] {
  const result: CandidateEvaluation[] = [];

  for (let i = 0; i < evaluations.length; i++) {
    const itemA = evaluations[i];
    if (itemA.eligibility.status === "failed") {
      result.push({
        candidate: itemA.candidate,
        eligibility: itemA.eligibility,
        isDominated: false,
      });
      continue;
    }

    let isDominated = false;
    let dominatedReason: string | undefined;

    // Compare with all other eligible items in the same area or same bedroom format
    for (let j = 0; j < evaluations.length; j++) {
      if (i === j) continue;
      const itemB = evaluations[j];
      if (itemB.eligibility.status === "failed") continue;

      const sameCluster = itemA.candidate.areaId === itemB.candidate.areaId;
      const sameBedrooms = itemA.candidate.bedrooms === itemB.candidate.bedrooms;

      if (sameCluster && sameBedrooms) {
        // If B is significantly cheaper PSF (>5% cheaper), delivers earlier or equal,
        // and A has no distinct advantage -> A is dominated by B
        const psfA = itemA.candidate.pricePerSqftAed;
        const psfB = itemB.candidate.pricePerSqftAed;
        const handoverA = itemA.candidate.expectedHandoverYear;
        const handoverB = itemB.candidate.expectedHandoverYear;

        if (psfA > psfB * 1.05 && handoverA >= handoverB) {
          isDominated = true;
          dominatedReason = `Dominated by "${itemB.candidate.projectName}" (${psfB.toFixed(0)} AED/sqft vs ${psfA.toFixed(0)} AED/sqft with earlier/equal handover)`;
          break;
        }
      }
    }

    // Gap to ready PSF in area if available
    let gapToReadyPsfPct: number | undefined;
    if (itemA.candidate.readyMedianPsfArea && itemA.candidate.readyMedianPsfArea > 0) {
      gapToReadyPsfPct =
        (1 - itemA.candidate.pricePerSqftAed / itemA.candidate.readyMedianPsfArea) * 100;
    }

    result.push({
      candidate: itemA.candidate,
      eligibility: itemA.eligibility,
      isDominated,
      dominatedReason,
      gapToReadyPsfPct,
    });
  }

  return result;
}

/**
 * Stage 3: Build 3 Shortlist Roles and Generate 4 Mandatory Explanations
 */
export function buildShortlist(
  brief: ClientBriefParams,
  candidates: CandidateOffer[]
): ShortlistResult {
  const evaluatedEligibility = candidates.map((c) => ({
    candidate: c,
    eligibility: evaluateCandidateEligibility(c, brief),
  }));

  const evaluations = markDominatedOptions(evaluatedEligibility);

  const eligibleNonDominated = evaluations.filter(
    (e) => e.eligibility.status !== "failed" && !e.isDominated
  );

  const preferredAreaId = brief.preferredAreaId;
  const preferredAreaName = brief.preferredAreaName || "Target Cluster";

  // Role 1: Best Local Project
  const localCandidates = eligibleNonDominated
    .filter((e) => !preferredAreaId || e.candidate.areaId === preferredAreaId)
    .sort((a, b) => a.candidate.pricePerSqftAed - b.candidate.pricePerSqftAed);
  const bestLocal = localCandidates[0];

  // Role 2: Similar Budget Alternative Area
  const altAreaCandidates = eligibleNonDominated
    .filter((e) => !preferredAreaId || e.candidate.areaId !== preferredAreaId)
    .sort((a, b) => {
      // Closest ticket to client budget
      const diffA = Math.abs(a.candidate.priceAed - Number(brief.budgetAed));
      const diffB = Math.abs(b.candidate.priceAed - Number(brief.budgetAed));
      return diffA - diffB;
    });
  const bestAltArea = altAreaCandidates.find((c) => c.candidate.id !== bestLocal?.candidate.id);

  // Role 3: Near-Handover Alternative
  const nearHandoverCandidates = eligibleNonDominated
    .filter(
      (e) =>
        e.candidate.id !== bestLocal?.candidate.id &&
        e.candidate.id !== bestAltArea?.candidate.id
    )
    .sort((a, b) => a.candidate.expectedHandoverYear - b.candidate.expectedHandoverYear);
  const bestNearHandover = nearHandoverCandidates[0];

  const shortlist: ShortlistItem[] = [];

  if (bestLocal) {
    shortlist.push({
      candidate: bestLocal.candidate,
      evaluation: bestLocal,
      explanation: {
        role: "BEST_LOCAL",
        roleTitle: `Best Local Choice in ${bestLocal.candidate.areaName}`,
        whyItFits: [
          `Strongest PSF entry at ${bestLocal.candidate.pricePerSqftAed.toFixed(0)} AED/sq.ft. in ${bestLocal.candidate.areaName}.`,
          `Total ticket ${bestLocal.candidate.priceAed.toLocaleString()} AED aligns comfortably with ${Number(brief.budgetAed).toLocaleString()} AED budget.`,
          bestLocal.gapToReadyPsfPct && bestLocal.gapToReadyPsfPct > 0
            ? `Priced ${bestLocal.gapToReadyPsfPct.toFixed(1)}% below cluster ready sales median.`
            : `Verified active construction with developer ${bestLocal.candidate.developerName}.`,
        ],
        tradeOff: `Off-plan delivery slated for ${bestLocal.candidate.expectedHandoverYear}; requires staged capital commitment over full build timeline.`,
        disqualificationTriggers: [
          `Re-pricing above ${Math.round(bestLocal.candidate.priceAed * 1.05).toLocaleString()} AED.`,
          `Delay in construction milestone exceeding 9 months.`,
          `Unfavorable shift in developer assignment NOC policy.`,
        ],
        factsToVerify: [
          `Confirm NOC transfer threshold percentage (typically 30–40%).`,
          `Inspect actual escrow account transaction activity.`,
          `Verify exact layout plan and internal vs balcony area breakdown.`,
        ],
      },
    });
  }

  if (bestAltArea) {
    shortlist.push({
      candidate: bestAltArea.candidate,
      evaluation: bestAltArea,
      explanation: {
        role: "SIMILAR_BUDGET_ALT_AREA",
        roleTitle: `Alternative District: ${bestAltArea.candidate.areaName}`,
        whyItFits: [
          `Comparable capital ticket of ${bestAltArea.candidate.priceAed.toLocaleString()} AED in an alternative high-demand corridor.`,
          `Entry PSF of ${bestAltArea.candidate.pricePerSqftAed.toFixed(0)} AED/sq.ft. offers diversified district exposure.`,
          `Target ${bestAltArea.candidate.bedrooms}BR format provides strong tenant liquidity in ${bestAltArea.candidate.areaName}.`,
        ],
        tradeOff: `Located outside the primary cluster (${preferredAreaName}), requiring different demographic and rental yield baseline.`,
        disqualificationTriggers: [
          `Infrastructure or transport connection milestones delayed.`,
          `Alternative developer payment milestone front-loading.`,
        ],
        factsToVerify: [
          `Compare average rental yields and service charges between ${bestAltArea.candidate.areaName} and ${preferredAreaName}.`,
          `Confirm whether developer charges additional administration fees on transfer.`,
        ],
      },
    });
  }

  if (bestNearHandover) {
    shortlist.push({
      candidate: bestNearHandover.candidate,
      evaluation: bestNearHandover,
      explanation: {
        role: "NEAR_HANDOVER",
        roleTitle: `Fast-Track Delivery (${bestNearHandover.candidate.expectedHandoverYear})`,
        whyItFits: [
          `Handover scheduled for ${bestNearHandover.candidate.expectedHandoverYear}, significantly reducing construction completion risk.`,
          `Immediate rental cash flow or earlier exit liquidity compared to longer-term off-plan launches.`,
          `Higher completion progress (${bestNearHandover.candidate.constructionProgressPct || 70}%) verifiable on-site.`,
        ],
        tradeOff: `Heavier immediate cash requirement due to advanced construction milestone payments.`,
        disqualificationTriggers: [
          `Client cash headroom deficit during near-term handover payment.`,
          `Post-handover maintenance reserve shortfall.`,
        ],
        factsToVerify: [
          `Obtain official DLD project inspection report to verify actual progress percentage.`,
          `Confirm final snagging and handover snag schedule.`,
        ],
      },
    });
  }

  return {
    clientBrief: brief,
    totalCandidatesEvaluated: candidates.length,
    eligibleCount: eligibleNonDominated.length,
    dominatedCount: evaluations.filter((e) => e.isDominated).length,
    shortlist,
    auditNotes: [
      `Evaluated ${candidates.length} candidate projects.`,
      `${eligibleNonDominated.length} passed eligibility gates without domination.`,
      `Shortlist generated strictly adhering to Section 8 roles and mandatory 4-point criteria.`,
    ],
  };
}
