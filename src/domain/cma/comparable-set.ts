import { Decimal, toDecimal } from "@/lib/decimal";

export interface TransactionFact {
  id: string;
  buildingName: string;
  bedrooms: number; // 0 for studio
  areaSqft: number;
  salePriceAED: number;
  pricePerSqftAED: number;
  transactionDate: string; // YYYY-MM-DD
  isOffPlan: boolean;
  expectedHandoverDate?: string | null;
}

export type CMASampleReliability = "ROBUST" | "WEAK_SAMPLE" | "INSUFFICIENT";

export interface BuildingShare {
  buildingName: string;
  count: number;
  sharePct: number;
  medianPsf: Decimal | null;
  medianPriceAed?: Decimal | null;
  medianAreaSqft?: Decimal | null;
  minPsf?: Decimal | null;
  maxPsf?: Decimal | null;
}

export interface CMAGroupStats {
  groupName: "Group A: Ready" | "Group B: Off-Plan Comparable" | "Group C: Near-Handover";
  count: number;
  distinctBuildings: number;
  maxBuildingSharePct: number;
  dominantBuildingName: string | null;
  medianPsf: Decimal | null;
  p25Psf: Decimal | null;
  p75Psf: Decimal | null;
  iqrPsf: Decimal | null;
  medianPriceAed?: Decimal | null;
  p25PriceAed?: Decimal | null;
  p75PriceAed?: Decimal | null;
  medianAreaSqft?: Decimal | null;
  minPsf?: Decimal | null;
  maxPsf?: Decimal | null;
  reliability: CMASampleReliability;
  reliabilityNote: string;
  buildingBreakdown: BuildingShare[];
  transactions: TransactionFact[];
}

export interface CMAResult {
  targetPsf: Decimal;
  targetPrice: Decimal;
  targetAreaSqft: Decimal;
  targetUnitLabel?: string;
  targetPriceSource?: "net" | "list" | "custom" | "fallback";
  readyGroup: CMAGroupStats;
  offPlanGroup: CMAGroupStats;
  nearHandoverGroup: CMAGroupStats;
  gapToReadyPercent: Decimal | null;
  gapToOffPlanPercent: Decimal | null;
  gapToNearHandoverPercent?: Decimal | null;
  editorialConclusion: string;
}

/**
 * Calculates median and quartiles for an array of numbers
 */
export function calculateDistribution(numbers: number[]): {
  median: Decimal | null;
  p25: Decimal | null;
  p75: Decimal | null;
  iqr: Decimal | null;
} {
  if (numbers.length === 0) return { median: null, p25: null, p75: null, iqr: null };
  const sorted = [...numbers].sort((a, b) => a - b);
  const n = sorted.length;

  const medianVal =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  const p25Index = Math.floor(n * 0.25);
  const p75Index = Math.floor(n * 0.75);

  const median = new Decimal(medianVal);
  const p25 = new Decimal(sorted[p25Index]);
  const p75 = new Decimal(sorted[p75Index]);
  const iqr = p75.minus(p25);

  return { median, p25, p75, iqr };
}

/**
 * Builds statistics for a single comparable group
 */
export function buildGroupStats(
  groupName: "Group A: Ready" | "Group B: Off-Plan Comparable" | "Group C: Near-Handover",
  transactions: TransactionFact[]
): CMAGroupStats {
  const count = transactions.length;
  const buildingCounts = new Map<string, number>();
  const buildingPsfs = new Map<string, number[]>();
  const buildingPrices = new Map<string, number[]>();
  const buildingAreas = new Map<string, number[]>();

  for (const t of transactions) {
    const bName = t.buildingName || "Unknown Building";
    buildingCounts.set(bName, (buildingCounts.get(bName) || 0) + 1);

    const existingPsfs = buildingPsfs.get(bName) || [];
    existingPsfs.push(t.pricePerSqftAED);
    buildingPsfs.set(bName, existingPsfs);

    if (t.salePriceAED && t.salePriceAED > 0) {
      const existingPrices = buildingPrices.get(bName) || [];
      existingPrices.push(t.salePriceAED);
      buildingPrices.set(bName, existingPrices);
    }

    if (t.areaSqft && t.areaSqft > 0) {
      const existingAreas = buildingAreas.get(bName) || [];
      existingAreas.push(t.areaSqft);
      buildingAreas.set(bName, existingAreas);
    }
  }

  const distinctBuildings = buildingCounts.size;
  let maxCount = 0;
  let dominantBuildingName: string | null = null;
  const buildingBreakdown: BuildingShare[] = [];

  for (const [bName, bCnt] of buildingCounts.entries()) {
    if (bCnt > maxCount) {
      maxCount = bCnt;
      dominantBuildingName = bName;
    }
    const bPsfList = buildingPsfs.get(bName) || [];
    const bDist = calculateDistribution(bPsfList);
    const bPriceDist = calculateDistribution(buildingPrices.get(bName) || []);
    const bAreaDist = calculateDistribution(buildingAreas.get(bName) || []);

    const sortedBPsfs = [...bPsfList].sort((a, b) => a - b);
    const minPsf = sortedBPsfs.length > 0 ? new Decimal(sortedBPsfs[0]) : null;
    const maxPsf = sortedBPsfs.length > 0 ? new Decimal(sortedBPsfs[sortedBPsfs.length - 1]) : null;

    buildingBreakdown.push({
      buildingName: bName,
      count: bCnt,
      sharePct: count > 0 ? Math.round((bCnt / count) * 1000) / 10 : 0,
      medianPsf: bDist.median,
      medianPriceAed: bPriceDist.median,
      medianAreaSqft: bAreaDist.median,
      minPsf,
      maxPsf,
    });
  }

  // Sort breakdown descending by count
  buildingBreakdown.sort((a, b) => b.count - a.count);

  const maxBuildingSharePct = count > 0 ? Math.round((maxCount / count) * 1000) / 10 : 0;
  const allPsfs = transactions.map((t) => t.pricePerSqftAED);
  const dist = calculateDistribution(allPsfs);
  const priceDist = calculateDistribution(transactions.map((t) => t.salePriceAED).filter((p) => p > 0));
  const areaDist = calculateDistribution(transactions.map((t) => t.areaSqft).filter((a) => a > 0));

  const sortedAllPsfs = [...allPsfs].sort((a, b) => a - b);
  const minPsf = sortedAllPsfs.length > 0 ? new Decimal(sortedAllPsfs[0]) : null;
  const maxPsf = sortedAllPsfs.length > 0 ? new Decimal(sortedAllPsfs[sortedAllPsfs.length - 1]) : null;

  let reliability: CMASampleReliability = "INSUFFICIENT";
  let reliabilityNote = "Insufficient sample (<5 transactions). Comparative gap headline is blocked.";

  if (count >= 15 && distinctBuildings >= 3) {
    reliability = "ROBUST";
    reliabilityNote = `Robust sample: ${count} transactions across ${distinctBuildings} buildings.`;
    if (maxBuildingSharePct >= 70) {
      reliabilityNote += ` Note: ${maxBuildingSharePct}% of transactions are from "${dominantBuildingName}".`;
    }
  } else if (count >= 5) {
    reliability = "WEAK_SAMPLE";
    reliabilityNote = `Moderate sample: ${count} transactions across ${distinctBuildings} buildings. Treat gap with caution.`;
  }

  return {
    groupName,
    count,
    distinctBuildings,
    maxBuildingSharePct,
    dominantBuildingName,
    medianPsf: dist.median,
    p25Psf: dist.p25,
    p75Psf: dist.p75,
    iqrPsf: dist.iqr,
    medianPriceAed: priceDist.median,
    p25PriceAed: priceDist.p25,
    p75PriceAed: priceDist.p75,
    medianAreaSqft: areaDist.median,
    minPsf,
    maxPsf,
    reliability,
    reliabilityNote,
    buildingBreakdown,
    transactions,
  };
}

/**
 * Builds CMA groups and evaluates sample gates according to Section 7:
 * - Group A (Ready): verified secondary registered transactions
 * - Group B (Off-plan comparable term): similar off-plan launch window
 * - Group C (Near-handover): similar off-plan format closer to completion
 * - Gates:
 *   - <5 records: INSUFFICIENT -> descriptive only, no gap headline allowed
 *   - 5-14 records: WEAK_SAMPLE -> cautionary note
 *   - >=15 records and >=3 buildings: ROBUST -> reliable comparative gap
 * - gap_to_ready = 1 - (target_psf / ready_median_psf)
 */
export function buildComparableSet(
  targetPriceAED: number | string | Decimal,
  targetAreaSqft: number | string | Decimal,
  readyTransactions: TransactionFact[],
  offPlanTransactions: TransactionFact[],
  nearHandoverTransactions: TransactionFact[] = [],
  meta?: {
    targetUnitLabel?: string;
    targetPriceSource?: "net" | "list" | "custom" | "fallback";
  }
): CMAResult {
  const targetPrice = toDecimal(targetPriceAED);
  const targetArea = toDecimal(targetAreaSqft);
  const targetPsf = targetArea.isZero() ? new Decimal(0) : targetPrice.dividedBy(targetArea);

  const readyGroup = buildGroupStats("Group A: Ready", readyTransactions);
  const offPlanGroup = buildGroupStats("Group B: Off-Plan Comparable", offPlanTransactions);
  const nearHandoverGroup = buildGroupStats("Group C: Near-Handover", nearHandoverTransactions);

  // Gap to ready: 1 - target_psf / ready_median_psf
  let gapToReady: Decimal | null = null;
  let conclusion = "Comparative analysis pending verified transaction data.";

  if (readyGroup.medianPsf && !readyGroup.medianPsf.isZero() && readyGroup.reliability !== "INSUFFICIENT") {
    gapToReady = new Decimal(1).minus(targetPsf.dividedBy(readyGroup.medianPsf)).times(100);
    const gapFormatted = `${gapToReady.toFixed(1)}%`;
    if (gapToReady.greaterThan(0)) {
      conclusion = `Asking price of ${targetPsf.toFixed(0)} AED/sq.ft. is ${gapFormatted} below the median of verified ready comparables (${readyGroup.medianPsf.toFixed(0)} AED/sq.ft. across N=${readyGroup.count} sales).`;
    } else {
      conclusion = `Asking price of ${targetPsf.toFixed(0)} AED/sq.ft. is ${gapToReady.abs().toFixed(1)}% above the median of verified ready comparables (${readyGroup.medianPsf.toFixed(0)} AED/sq.ft.).`;
    }
  } else if (readyGroup.reliability === "INSUFFICIENT") {
    conclusion = `Observed sample has only ${readyGroup.count} ready transactions in cluster. Not sufficient for reliable price gap determination.`;
  }

  // Gap to off-plan comparable: 1 - target_psf / offplan_median_psf
  let gapToOffPlan: Decimal | null = null;
  if (offPlanGroup.medianPsf && !offPlanGroup.medianPsf.isZero() && offPlanGroup.reliability !== "INSUFFICIENT") {
    gapToOffPlan = new Decimal(1).minus(targetPsf.dividedBy(offPlanGroup.medianPsf)).times(100);
  }

  // Gap to near-handover: 1 - target_psf / nearHandover_median_psf
  let gapToNearHandover: Decimal | null = null;
  if (nearHandoverGroup.medianPsf && !nearHandoverGroup.medianPsf.isZero() && nearHandoverGroup.reliability !== "INSUFFICIENT") {
    gapToNearHandover = new Decimal(1).minus(targetPsf.dividedBy(nearHandoverGroup.medianPsf)).times(100);
  }

  return {
    targetPsf,
    targetPrice,
    targetAreaSqft: targetArea,
    targetUnitLabel: meta?.targetUnitLabel,
    targetPriceSource: meta?.targetPriceSource,
    readyGroup,
    offPlanGroup,
    nearHandoverGroup,
    gapToReadyPercent: gapToReady,
    gapToOffPlanPercent: gapToOffPlan,
    gapToNearHandoverPercent: gapToNearHandover,
    editorialConclusion: conclusion,
  };
}
