import { describe, it, expect } from "vitest";
import {
  buildComparableSet,
  buildGroupStats,
  calculateDistribution,
  type TransactionFact,
} from "@/domain/cma/comparable-set";
import { Decimal } from "@/lib/decimal";

describe("Phase 3: CMA 3-Groups & Statistical Sample Gates Engine", () => {
  const createTx = (
    id: string,
    building: string,
    psf: number,
    isOffPlan: boolean,
    bedrooms = 1
  ): TransactionFact => ({
    id,
    buildingName: building,
    bedrooms,
    areaSqft: 750,
    salePriceAED: psf * 750,
    pricePerSqftAED: psf,
    transactionDate: "2024-10-15",
    isOffPlan,
  });

  describe("1. Distribution & Quartiles Calculation", () => {
    it("correctly calculates median, P25, P75, and IQR", () => {
      // 5 numbers: 1000, 2000, 3000, 4000, 5000
      const dist = calculateDistribution([1000, 2000, 3000, 4000, 5000]);
      expect(dist.median?.toNumber()).toBe(3000);
      expect(dist.p25?.toNumber()).toBe(2000);
      expect(dist.p75?.toNumber()).toBe(4000);
      expect(dist.iqr?.toNumber()).toBe(2000);
    });

    it("returns nulls for empty array", () => {
      const dist = calculateDistribution([]);
      expect(dist.median).toBeNull();
      expect(dist.p25).toBeNull();
      expect(dist.p75).toBeNull();
      expect(dist.iqr).toBeNull();
    });
  });

  describe("2. Sample Reliability Gates (§7 & ADR 004)", () => {
    it("triggers INSUFFICIENT gate when sample size < 5", () => {
      const txs = [
        createTx("1", "Tower A", 2000, false),
        createTx("2", "Tower A", 2100, false),
        createTx("3", "Tower B", 2200, false),
      ];
      const stats = buildGroupStats("Group A: Ready", txs);
      expect(stats.reliability).toBe("INSUFFICIENT");
      expect(stats.count).toBe(3);
      expect(stats.reliabilityNote).toContain("Insufficient sample");
    });

    it("triggers WEAK_SAMPLE gate when count between 5 and 14", () => {
      const txs = Array.from({ length: 8 }, (_, i) =>
        createTx(`tx_${i}`, i % 2 === 0 ? "Tower A" : "Tower B", 2000 + i * 50, false)
      );
      const stats = buildGroupStats("Group A: Ready", txs);
      expect(stats.reliability).toBe("WEAK_SAMPLE");
      expect(stats.count).toBe(8);
      expect(stats.distinctBuildings).toBe(2);
      expect(stats.reliabilityNote).toContain("Moderate sample");
    });

    it("triggers ROBUST gate when >= 15 transactions across >= 3 buildings", () => {
      const txs = Array.from({ length: 18 }, (_, i) =>
        createTx(`tx_${i}`, `Tower_${i % 4}`, 2200 + (i % 5) * 50, false)
      );
      const stats = buildGroupStats("Group A: Ready", txs);
      expect(stats.reliability).toBe("ROBUST");
      expect(stats.count).toBe(18);
      expect(stats.distinctBuildings).toBe(4);
      expect(stats.reliabilityNote).toContain("Robust sample");
    });

    it("detects single-building concentration (>70% share)", () => {
      // 15 txs, but 12 in Tower A, 2 in Tower B, 1 in Tower C
      const txs = [
        ...Array.from({ length: 12 }, (_, i) => createTx(`a_${i}`, "Dominant Tower", 2100, false)),
        createTx("b_1", "Tower B", 2200, false),
        createTx("b_2", "Tower B", 2250, false),
        createTx("c_1", "Tower C", 2300, false),
      ];
      const stats = buildGroupStats("Group A: Ready", txs);
      expect(stats.reliability).toBe("ROBUST");
      expect(stats.distinctBuildings).toBe(3);
      expect(stats.dominantBuildingName).toBe("Dominant Tower");
      expect(stats.maxBuildingSharePct).toBe(80); // 12 / 15 = 80%
      expect(stats.reliabilityNote).toContain('80% of transactions are from "Dominant Tower"');
    });
  });

  describe("3. Three Comparable Groups & Price Gap (§7)", () => {
    it("computes exact gap to ready and gap to off-plan", () => {
      // Target unit: 1,500,000 AED / 750 sqft = 2,000 PSF
      const targetPrice = 1500000;
      const targetArea = 750;

      // Group A (Ready): Median 2,400 PSF across 15 txs in 3 towers
      const readyTxs = Array.from({ length: 15 }, (_, i) =>
        createTx(`r_${i}`, `Ready_${i % 3}`, 2400, false)
      );

      // Group B (Off-Plan): Median 2,200 PSF across 15 txs in 3 towers
      const offPlanTxs = Array.from({ length: 15 }, (_, i) =>
        createTx(`op_${i}`, `OffPlan_${i % 3}`, 2200, true)
      );

      // Group C (Near-Handover): Median 2,300 PSF across 8 txs
      const nearTxs = Array.from({ length: 8 }, (_, i) =>
        createTx(`nh_${i}`, `Near_${i % 2}`, 2300, true)
      );

      const result = buildComparableSet(
        targetPrice,
        targetArea,
        readyTxs,
        offPlanTxs,
        nearTxs
      );

      // Target PSF = 2000
      expect(result.targetPsf.toNumber()).toBe(2000);

      // Ready median = 2400
      // Gap to ready = 1 - 2000 / 2400 = 16.666...%
      expect(result.gapToReadyPercent?.toNumber()).toBeCloseTo(16.67, 1);

      // Off-plan median = 2200
      // Gap to off-plan = 1 - 2000 / 2200 = 9.09...%
      expect(result.gapToOffPlanPercent?.toNumber()).toBeCloseTo(9.09, 1);

      // Group A, B, C populated
      expect(result.readyGroup.groupName).toBe("Group A: Ready");
      expect(result.readyGroup.reliability).toBe("ROBUST");
      expect(result.offPlanGroup.groupName).toBe("Group B: Off-Plan Comparable");
      expect(result.offPlanGroup.reliability).toBe("ROBUST");
      expect(result.nearHandoverGroup.groupName).toBe("Group C: Near-Handover");
      expect(result.nearHandoverGroup.reliability).toBe("WEAK_SAMPLE");

      // Editorial conclusion
      expect(result.editorialConclusion).toContain("16.7% below the median");
    });

    it("suppresses gap percentage when ready sample is INSUFFICIENT", () => {
      const targetPrice = 1500000;
      const targetArea = 750;

      // Only 2 ready transactions
      const readyTxs = [
        createTx("r1", "Tower A", 2400, false),
        createTx("r2", "Tower B", 2450, false),
      ];

      const result = buildComparableSet(targetPrice, targetArea, readyTxs, []);
      expect(result.gapToReadyPercent).toBeNull();
      expect(result.editorialConclusion).toContain("Not sufficient for reliable price gap determination");
    });
  });
});
