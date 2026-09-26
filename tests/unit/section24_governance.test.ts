import { describe, it, expect } from "vitest";
import { calculatePeriodReturn, calculateBreakEven } from "@/domain/returns/calculate-period-return";
import { evaluateFunding, ClientFundingProfile, OfferPaymentSchedule } from "@/domain/funding/evaluate-funding";
import { validateTransferEligibility } from "@/domain/exit/transfer-eligibility";
import { buildComparableSet, TransactionFact } from "@/domain/cma/comparable-set";

describe("Section 24 Specification Verification Test Suite", () => {
  describe("1. Pure Financial Return Verification (Section 11 & 24)", () => {
    it("Test 1: P=2M, paid=40% (800k), premium=+15% (S=2.3M), zero costs -> 300k profit, 37.5% ROI", () => {
      const res = calculatePeriodReturn({
        contractPrice: 2000000,
        paidCapital: 800000,
        acquisitionCosts: 0,
        resalePrice: 2300000,
        exitCosts: 0,
      });

      expect(res.outstandingBalance.toNumber()).toBe(1200000);
      expect(res.sellerReceipt.toNumber()).toBe(1100000);
      expect(res.investedCash.toNumber()).toBe(800000);
      expect(res.netProfit.toNumber()).toBe(300000);
      expect(res.returnOnInvestedCash.toNumber()).toBe(37.5);
    });

    it("Test 2A: Same with C=80k, E=50k -> 170k profit, 19.318...% ROI", () => {
      const res = calculatePeriodReturn({
        contractPrice: 2000000,
        paidCapital: 800000,
        acquisitionCosts: 800000 * 0 + 80000, // C = 80k
        resalePrice: 2300000,
        exitCosts: 50000, // E = 50k
      });

      expect(res.sellerReceipt.toNumber()).toBe(1050000); // 2.3M - 1.2M - 50k
      expect(res.investedCash.toNumber()).toBe(880000); // 800k + 80k
      expect(res.netProfit.toNumber()).toBe(170000); // 1.05M - 880k
      // 170,000 / 880,000 = 19.3181818...%
      expect(res.returnOnInvestedCash.toFixed(3)).toBe("19.318");
    });

    it("Test 2B: Downside S=1.8M with C=80k, E=50k -> -330k loss, -37.5% return on invested cash", () => {
      const res = calculatePeriodReturn({
        contractPrice: 2000000,
        paidCapital: 800000,
        acquisitionCosts: 80000,
        resalePrice: 1800000,
        exitCosts: 50000,
      });

      expect(res.sellerReceipt.toNumber()).toBe(550000); // 1.8M - 1.2M - 50k
      expect(res.investedCash.toNumber()).toBe(880000);
      expect(res.netProfit.toNumber()).toBe(-330000);
      expect(res.returnOnInvestedCash.toFixed(1)).toBe("-37.5");
    });

    it("Test 3: Break-Even calculation with fixed & variable exit costs", () => {
      // P=2M, C=80k, fixedExit=10k, variableExit=2% (0.02)
      // S_break_even = (2,000,000 + 80,000 + 10,000) / (1 - 0.02) = 2,090,000 / 0.98 = 2,132,653.06...
      const breakEven = calculateBreakEven({
        contractPrice: 2000000,
        acquisitionCosts: 80000,
        fixedExitCosts: 10000,
        variableExitRate: 0.02,
      });

      expect(breakEven.toFixed(2)).toBe("2132653.06");
    });
  });

  describe("2. Client Funding & Solvency Gate Verification (Section 9 & 24)", () => {
    const mockOffer: OfferPaymentSchedule = {
      offerId: "off-1",
      projectName: "Downtown Views II",
      contractPrice: 2000000,
      milestones: [
        { date: "2026-10-01", amount: 400000, percent: 20, description: "Booking 20%" },
        { date: "2027-04-01", amount: 200000, percent: 10, description: "Foundation 10%" },
        { date: "2027-10-01", amount: 400000, percent: 20, description: "Structure 20%" },
        { date: "2028-12-01", amount: 1000000, percent: 50, description: "Handover 50%" },
      ],
      fees: [
        { date: "2026-10-01", amount: 84000, description: "DLD 4% + Admin fee" },
      ],
    };

    it("Test 4: Client with only 20% (400k) initial cash and no subsequent inflows -> NOT_SUITABLE", () => {
      const client: ClientFundingProfile = {
        initialLiquidCash: 400000,
        requiredReserve: 50000,
        plannedInflows: [],
      };

      const evalResult = evaluateFunding(client, mockOffer);
      expect(evalResult.status).toBe("NOT_SUITABLE");
    });

    it("Test 5: Client has income that arrives AFTER a large installment -> FAILS on that milestone date", () => {
      const client: ClientFundingProfile = {
        initialLiquidCash: 500000,
        requiredReserve: 50000,
        plannedInflows: [
          // Client expects 500k in May 2027, but the installment of 200k + previous 484k is due in April
          { date: "2027-05-01", amount: 500000, label: "Bonus payout" },
        ],
      };

      const evalResult = evaluateFunding(client, mockOffer);
      // On 2026-10-01: paid 400k + 84k fee = 484k. Remaining cash = 16k. Reserve is 50k -> headroom = -34k
      expect(evalResult.status).toBe("FAILED");
      expect(evalResult.deficitDate).toBe("2026-10-01");
      expect(evalResult.deficitAmount?.toNumber()).toBeGreaterThan(0);
    });

    it("Test 6: Client with well-scheduled liquidity -> PASSED", () => {
      const client: ClientFundingProfile = {
        initialLiquidCash: 800000,
        requiredReserve: 50000,
        plannedInflows: [
          { date: "2027-03-01", amount: 400000, label: "Savings replenishment" },
          { date: "2028-06-01", amount: 1200000, label: "Asset sale / business dividend" },
        ],
      };

      const evalResult = evaluateFunding(client, mockOffer);
      expect(evalResult.status).toBe("PASSED");
      expect(evalResult.minHeadroom.toNumber()).toBeGreaterThan(0);
    });
  });

  describe("3. Transfer & NOC Assignment Verification (Section 12 & 24)", () => {
    it("Test 7A: Paid 20% with 30% NOC threshold -> REQUIRES_TOPUP of 10% (200k AED)", () => {
      const res = validateTransferEligibility({
        contractPrice: 2000000,
        currentPaidAmount: 400000, // 20%
        minPaidPercentRequired: 30, // 30%
        assignmentPolicy: "allowed",
      });

      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("REQUIRES_TOPUP");
      expect(res.topupRequiredAED.toNumber()).toBe(200000);
    });

    it("Test 7B: Paid 35% with 30% NOC threshold -> ELIGIBLE", () => {
      const res = validateTransferEligibility({
        contractPrice: 2000000,
        currentPaidAmount: 700000, // 35%
        minPaidPercentRequired: 30,
        assignmentPolicy: "allowed",
      });

      expect(res.isEligible).toBe(true);
      expect(res.status).toBe("ELIGIBLE");
      expect(res.topupRequiredAED.toNumber()).toBe(0);
    });

    it("Test 7C: Developer prohibits assignment -> PROHIBITED", () => {
      const res = validateTransferEligibility({
        contractPrice: 2000000,
        currentPaidAmount: 800000,
        minPaidPercentRequired: 30,
        assignmentPolicy: "prohibited",
      });

      expect(res.isEligible).toBe(false);
      expect(res.status).toBe("PROHIBITED");
    });
  });

  describe("4. CMA Sample Gates & Gap Verification (Section 7 & 24)", () => {
    const mockReadySales: TransactionFact[] = [
      { id: "1", buildingName: "Tower A", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-06-01", isOffPlan: false },
      { id: "2", buildingName: "Tower A", bedrooms: 1, areaSqft: 780, salePriceAED: 1872000, pricePerSqftAED: 2400, transactionDate: "2026-06-15", isOffPlan: false },
      { id: "3", buildingName: "Tower B", bedrooms: 1, areaSqft: 720, salePriceAED: 1728000, pricePerSqftAED: 2400, transactionDate: "2026-07-01", isOffPlan: false },
      { id: "4", buildingName: "Tower C", bedrooms: 1, areaSqft: 800, salePriceAED: 1920000, pricePerSqftAED: 2400, transactionDate: "2026-07-20", isOffPlan: false },
    ];

    it("Test 8A: Sample size < 5 -> INSUFFICIENT gate triggers", () => {
      const cma = buildComparableSet(1500000, 750, mockReadySales, []);
      expect(cma.readyGroup.reliability).toBe("INSUFFICIENT");
      expect(cma.gapToReadyPercent).toBeNull();
    });

    it("Test 8B: Sample size >= 15 across 3 buildings -> ROBUST gate with exact gap calculation", () => {
      const robustSales: TransactionFact[] = [];
      const buildings = ["Building 1", "Building 2", "Building 3"];
      for (let i = 0; i < 18; i++) {
        robustSales.push({
          id: `tx-${i}`,
          buildingName: buildings[i % 3],
          bedrooms: 1,
          areaSqft: 750,
          salePriceAED: 1800000,
          pricePerSqftAED: 2400, // Ready median = 2400
          transactionDate: "2026-06-01",
          isOffPlan: false,
        });
      }

      // Target unit: 1.5M AED for 750 sqft = 2000 AED/sqft
      // gap = 1 - 2000/2400 = 16.666...% = 16.7%
      const cma = buildComparableSet(1500000, 750, robustSales, []);
      expect(cma.readyGroup.reliability).toBe("ROBUST");
      expect(cma.targetPsf.toNumber()).toBe(2000);
      expect(cma.readyGroup.medianPsf?.toNumber()).toBe(2400);
      expect(cma.gapToReadyPercent?.toFixed(1)).toBe("16.7");
    });
  });
});
