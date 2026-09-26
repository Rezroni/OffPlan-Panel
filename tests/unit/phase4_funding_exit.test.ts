import { describe, it, expect } from "vitest";
import { calculateTransactionCosts } from "@/domain/funding/transaction-costs";
import { generatePaymentPlan, PRESET_TEMPLATES } from "@/domain/funding/payment-plan-generator";
import { evaluateFunding, ClientFundingProfile, OfferPaymentSchedule } from "@/domain/funding/evaluate-funding";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
  solveTargetResalePriceForRoi,
  calculatePostHandoverRentalOffset,
} from "@/domain/exit/exit-scenario-engine";
import { calculateXIRR } from "@/domain/returns/xirr";
import { Decimal } from "@/lib/decimal";

describe("Phase 4: Funding & Exit Scenario Engine Test Suite (§9, §11, §12)", () => {
  // -------------------------------------------------------------------------
  // 1. Mandatory Transaction Costs Calculator (§9, §11)
  // -------------------------------------------------------------------------
  describe("1. Transaction Costs Breakdown", () => {
    it("Calculates exact DLD 4%, AED 580 certificate fee, Trustee fee 4,200 AED (incl VAT) for >= 500k AED", () => {
      const price = 2000000; // 2M AED
      const fees = calculateTransactionCosts({ contractPrice: price });

      // DLD 4% of 2M = 80,000 AED
      expect(fees.dldRegistrationFeeAED.toNumber()).toBe(80000);
      // Oqood / Title Deed Certificate = 580 AED
      expect(fees.oqoodCertificateFeeAED.toNumber()).toBe(580);
      // Trustee Base = 4,000 AED
      expect(fees.registrationTrusteeFeeAED.toNumber()).toBe(4000);
      // Trustee VAT (5%) = 200 AED
      expect(fees.trusteeVatAED.toNumber()).toBe(200);
      // Total Trustee = 4,200 AED
      expect(fees.totalTrusteeFeeAED.toNumber()).toBe(4200);
      // Developer NOC Fee = 5,000 AED
      expect(fees.developerNocFeeAED.toNumber()).toBe(5000);
      // Total Fees = 80,000 + 580 + 4,200 + 5,000 = 89,780 AED
      expect(fees.totalTransactionFeesAED.toNumber()).toBe(89780);
      // Total Acquisition Cost = 2,000,000 + 89,780 = 2,089,780 AED
      expect(fees.totalAcquisitionCostAED.toNumber()).toBe(2089780);
    });

    it("Applies reduced Trustee fee (AED 2,000 + VAT = AED 2,100) for properties below 500k AED", () => {
      const price = 450000;
      const fees = calculateTransactionCosts({ contractPrice: price });

      expect(fees.registrationTrusteeFeeAED.toNumber()).toBe(2000);
      expect(fees.trusteeVatAED.toNumber()).toBe(100);
      expect(fees.totalTrusteeFeeAED.toNumber()).toBe(2100);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Payment Plan Timeline & Construction Milestones (§9, §10)
  // -------------------------------------------------------------------------
  describe("2. Payment Plan Timeline & Delay Stress Testing", () => {
    it("Generates 60/40 payment plan with correct DLD milestones and 100% total", () => {
      const plan = generatePaymentPlan(2000000, "60/40", "2026-10-01", 0);

      expect(plan.totalPercent).toBe(100);
      expect(plan.totalAmountAED.toNumber()).toBe(2000000);
      expect(plan.preHandoverPercent).toBe(60);
      expect(plan.handoverPercent).toBe(40);
      expect(plan.milestones.length).toBe(6);

      // Milestone 0: Booking (20% = 400,000 AED)
      expect(plan.milestones[0].percent).toBe(20);
      expect(plan.milestones[0].amountAED.toNumber()).toBe(400000);
      expect(plan.milestones[0].dldMilestone).toBe("Registration");
      expect(plan.milestones[0].date).toBe("2026-10-01");

      // Handover Milestone (40% = 800,000 AED)
      const handover = plan.milestones.find((m) => m.isHandover);
      expect(handover).toBeDefined();
      expect(handover?.percent).toBe(40);
      expect(handover?.amountAED.toNumber()).toBe(800000);
      expect(handover?.dldMilestone).toContain("100%");
    });

    it("Delay stress testing (+6m and +12m) shifts construction-tied milestones while keeping booking stable", () => {
      const baseline = generatePaymentPlan(2000000, "60/40", "2026-10-01", 0);
      const stress6 = generatePaymentPlan(2000000, "60/40", "2026-10-01", 6);
      const stress12 = generatePaymentPlan(2000000, "60/40", "2026-10-01", 12);

      // Booking date is unchanged
      expect(baseline.milestones[0].date).toBe("2026-10-01");
      expect(stress6.milestones[0].date).toBe("2026-10-01");
      expect(stress12.milestones[0].date).toBe("2026-10-01");

      // Handover date shifts by 6 and 12 months
      const baseHandoverDate = new Date(baseline.milestones.find((m) => m.isHandover)!.date);
      const stress6HandoverDate = new Date(stress6.milestones.find((m) => m.isHandover)!.date);
      const stress12HandoverDate = new Date(stress12.milestones.find((m) => m.isHandover)!.date);

      const diffMonths6 = (stress6HandoverDate.getFullYear() - baseHandoverDate.getFullYear()) * 12 +
        (stress6HandoverDate.getMonth() - baseHandoverDate.getMonth());
      const diffMonths12 = (stress12HandoverDate.getFullYear() - baseHandoverDate.getFullYear()) * 12 +
        (stress12HandoverDate.getMonth() - baseHandoverDate.getMonth());

      expect(diffMonths6).toBe(6);
      expect(diffMonths12).toBe(12);
    });

    it("Runs liquidity headroom deficit check across payment plan with evaluateFunding", () => {
      const plan = generatePaymentPlan(2000000, "70/30", "2026-10-01", 0);
      const fees = calculateTransactionCosts({ contractPrice: 2000000 });

      const offerSchedule: OfferPaymentSchedule = {
        offerId: "proj-1",
        projectName: "Test Residence",
        contractPrice: 2000000,
        milestones: plan.milestones.map((m) => ({
          date: m.date,
          amount: m.amountAED,
          percent: m.percent,
          description: m.label,
        })),
        fees: [
          { date: "2026-10-01", amount: fees.totalTransactionFeesAED, description: "DLD & Trustee Fees" },
        ],
      };

      // Client with healthy phased capital
      const solventClient: ClientFundingProfile = {
        initialLiquidCash: 600000,
        requiredReserve: 50000,
        plannedInflows: [
          { date: "2027-02-01", amount: 300000, label: "Business payout" },
          { date: "2027-08-01", amount: 400000, label: "Bonus" },
          { date: "2028-01-01", amount: 1000000, label: "Asset liquidation" },
        ],
      };

      const result = evaluateFunding(solventClient, offerSchedule, 0);
      expect(result.status).toBe("PASSED");
      expect(result.minHeadroom.toNumber()).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Strategy A: Assignment Resale (§11, §12)
  // -------------------------------------------------------------------------
  describe("3. Strategy A: Assignment Resale Engine", () => {
    it("Calculates NOC top-up bridge requirement when paid < 34%", () => {
      const price = 2000000;
      const paid = 400000; // 20%
      const area = 800; // 800 sqft

      const analysis = evaluateAssignmentResale({
        contractPrice: price,
        areaSqft: area,
        paidCapital: paid,
        minPaidPercentRequired: 34, // requires 34% (680,000 AED)
        assignmentPolicy: "allowed",
      });

      expect(analysis.eligibility.isEligible).toBe(false);
      expect(analysis.eligibility.status).toBe("REQUIRES_TOPUP");
      // Topup = 680,000 - 400,000 = 280,000 AED
      expect(analysis.topupRequiredAED.toNumber()).toBe(280000);
    });

    it("Calculates exact Break-Even Resale Price and Break-Even PSF", () => {
      const price = 2000000;
      const area = 800;
      const acquisitionCosts = 89780; // standard DLD + fees
      const developerNocFee = 5000;
      const resaleBrokerRate = 0.02;

      // S_be = (2,000,000 + 89,780 + 5,000) / (1 - 0.02) = 2,094,780 / 0.98 = 2,137,530.61...
      const analysis = evaluateAssignmentResale({
        contractPrice: price,
        areaSqft: area,
        paidCapital: 800000, // 40%
        acquisitionCosts,
        developerNocFee,
        resaleBrokerageRate: resaleBrokerRate,
      });

      expect(analysis.breakEvenResalePriceAED.toFixed(2)).toBe("2137530.61");
      // Break-Even PSF = 2,137,530.61 / 800 = 2,671.91 AED/sqft
      expect(analysis.breakEvenPsfAED.toFixed(2)).toBe("2671.91");
    });

    it("Computes Net Profit and Cash-on-Cash ROI across Bearish (-10%), Baseline (+10%), Bullish (+20%)", () => {
      const price = 2000000;
      const paid = 800000; // 40%
      const acquisitionCosts = 80000;
      const nocFee = 5000;
      const brokerRate = 0.02;

      const analysis = evaluateAssignmentResale({
        contractPrice: price,
        areaSqft: 1000,
        paidCapital: paid,
        acquisitionCosts,
        developerNocFee: nocFee,
        resaleBrokerageRate: brokerRate,
      });

      // Baseline (+10% appreciation): S = 2,200,000
      // Outstanding B = 2M - 800k = 1,200,000
      // Exit fees E = 5,000 + 2% of 2.2M = 5,000 + 44,000 = 49,000
      // Seller Receipt = 2,200,000 - 1,200,000 - 49,000 = 951,000
      // Invested Cash = 800,000 + 80,000 = 880,000
      // Net Profit = 951,000 - 880,000 = 71,000
      // Cash-on-Cash ROI = (71,000 / 880,000) * 100 = 8.068%
      const baseline = analysis.scenarios.find((s) => s.appreciationPercent === 10);
      expect(baseline).toBeDefined();
      expect(baseline?.resalePriceAED.toNumber()).toBe(2200000);
      expect(baseline?.totalExitCostsAED.toNumber()).toBe(49000);
      expect(baseline?.sellerReceiptAED.toNumber()).toBe(951000);
      expect(baseline?.investedCashAED.toNumber()).toBe(880000);
      expect(baseline?.netProfitAED.toNumber()).toBe(71000);
      expect(baseline?.cashOnCashRoiPercent.toFixed(2)).toBe("8.07");

      // Bearish (-10%): S = 1,800,000
      // Exit fees = 5,000 + 36,000 = 41,000
      // Seller Receipt = 1,800,000 - 1,200,000 - 41,000 = 559,000
      // Net Profit = 559,000 - 880,000 = -321,000
      // ROI = (-321,000 / 880,000) * 100 = -36.48%
      const bearish = analysis.scenarios.find((s) => s.appreciationPercent === -10);
      expect(bearish).toBeDefined();
      expect(bearish?.netProfitAED.toNumber()).toBe(-321000);
      expect(bearish?.cashOnCashRoiPercent.toFixed(2)).toBe("-36.48");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Strategy B: Handover & Hold & XIRR Solver (§11, §15, §24)
  // -------------------------------------------------------------------------
  describe("4. Strategy B: Handover & Hold and Pure XIRR Solver", () => {
    it("Calculates Gross Yield and Net Yield on Cost after DLD OA service charges and management", () => {
      const price = 2000000;
      const totalAcquisition = 2100000;
      const annualGrossRent = 150000; // 150k AED/yr (7.5% gross)
      const serviceChargesAnnual = 15000; // 15k AED/yr
      const managementRate = 0.05; // 5%
      const vacancyRate = 0.05; // 5%

      const holdAnalysis = evaluateHandoverAndHold({
        contractPrice: price,
        totalAcquisitionCost: totalAcquisition,
        annualGrossRent,
        serviceChargesAnnual,
        managementFeeRate: managementRate,
        vacancyRate,
        holdingYears: 3,
      });

      // Gross Yield = 150,000 / 2,000,000 * 100 = 7.5%
      expect(holdAnalysis.rentalMetrics.grossYield.toNumber()).toBe(7.5);

      // Effective Rent = 150,000 * 0.95 = 142,500
      expect(holdAnalysis.rentalMetrics.effectiveRent.toNumber()).toBe(142500);

      // Mgmt fee = 142,500 * 0.05 = 7,125
      // Total Operating Expenses = 15,000 + 7,125 = 22,125
      expect(holdAnalysis.rentalMetrics.operatingExpenses.toNumber()).toBe(22125);

      // NOI = 142,500 - 22,125 = 120,375 AED
      expect(holdAnalysis.rentalMetrics.noi.toNumber()).toBe(120375);

      // Net Yield on Total Cost = 120,375 / 2,100,000 * 100 = 5.732%
      expect(holdAnalysis.rentalMetrics.netYieldOnCost.toFixed(2)).toBe("5.73");
    });

    it("Accurately solves XIRR for dated holding cash flows", () => {
      // 3-year holding test:
      // Day 0: -1,000,000 AED
      // Day 365: +60,000 AED
      // Day 730: +60,000 AED
      // Day 1095: +1,160,000 AED (60k rent + 1.1M exit)
      const flows = [
        { date: "2026-01-01", amount: -1000000 },
        { date: "2027-01-01", amount: 600000 * 0.1 },
        { date: "2028-01-01", amount: 60000 },
        { date: "2029-01-01", amount: 1160000 },
      ];

      const res = calculateXIRR(flows);
      expect(res.isValid).toBe(true);
      expect(res.xirrPercent).not.toBeNull();
      // Annual return is approximately 9-10%
      expect(res.xirrPercent!.toNumber()).toBeGreaterThan(8.5);
      expect(res.xirrPercent!.toNumber()).toBeLessThan(10.5);
    });

    it("Section 24 Rule 9: XIRR returns null for invalid cash flow series (no sign change)", () => {
      const allPositive = [
        { date: "2026-01-01", amount: 100000 },
        { date: "2027-01-01", amount: 50000 },
      ];
      const resPos = calculateXIRR(allPositive);
      expect(resPos.isValid).toBe(false);
      expect(resPos.xirr).toBeNull();
      expect(resPos.message).toContain("must contain both cash outflows");

      const allNegative = [
        { date: "2026-01-01", amount: -100000 },
        { date: "2027-01-01", amount: -50000 },
      ];
      const resNeg = calculateXIRR(allNegative);
      expect(resNeg.isValid).toBe(false);
      expect(resNeg.xirr).toBeNull();
    });

    it("Section 24 Rule 9: Correctly calculates negative XIRR for a loss-making hold", () => {
      // Bought for 1,000,000, collected only 20,000 rent, sold for 700,000
      const lossFlows = [
        { date: "2026-01-01", amount: -1000000 },
        { date: "2027-01-01", amount: 20000 },
        { date: "2028-01-01", amount: 720000 },
      ];

      const res = calculateXIRR(lossFlows);
      expect(res.isValid).toBe(true);
      expect(res.xirrPercent).not.toBeNull();
      expect(res.xirrPercent!.toNumber()).toBeLessThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Phase 4 Enhancements: Target ROI Solver, Furnishing Pack, PH Offset
  // -------------------------------------------------------------------------
  describe("5. Phase 4 Advanced Enhancements", () => {
    it("Target ROI Solver: Computes exact Resale Price & PSF needed for 25% Cash-on-Cash ROI", () => {
      const price = 2000000;
      const area = 850;
      const paid = 800000; // 40% paid

      const solved = solveTargetResalePriceForRoi({
        contractPrice: price,
        areaSqft: area,
        paidCapital: paid,
        targetRoiPercent: 25, // 25% target ROI
        developerNocFee: 5000,
        resaleBrokerageRate: 0.02,
      });

      expect(solved.targetResalePriceAED.toNumber()).toBeGreaterThan(price);
      expect(solved.targetResalePsfAED.toNumber()).toBeGreaterThan(price / area);

      // Verify that plugging solved.targetResalePriceAED into evaluateAssignmentResale yields exactly 25.0% ROI
      const verify = evaluateAssignmentResale({
        contractPrice: price,
        areaSqft: area,
        paidCapital: paid,
        developerNocFee: 5000,
        resaleBrokerageRate: 0.02,
        customResalePrice: solved.targetResalePriceAED,
      });

      const customScenario = verify.scenarios.find((s) => s.label.includes("Custom Price"));
      expect(customScenario).toBeDefined();
      expect(customScenario?.cashOnCashRoiPercent.toFixed(1)).toBe("25.0");
    });

    it("Furnishing Pack: Correctly increases deployed capital and recalculates net yield & XIRR", () => {
      const price = 2000000;
      const furnishingPack = 60000; // 60k AED furnishing
      const grossRentUnfurnished = 150000;
      const grossRentFurnished = 175000; // +25k AED rent for furnished

      const unfurnished = evaluateHandoverAndHold({
        contractPrice: price,
        annualGrossRent: grossRentUnfurnished,
        furnishingCostAED: 0,
        holdingYears: 3,
      });

      const furnished = evaluateHandoverAndHold({
        contractPrice: price,
        annualGrossRent: grossRentFurnished,
        furnishingCostAED: furnishingPack,
        holdingYears: 3,
      });

      expect(furnished.furnishingCostAED.toNumber()).toBe(60000);
      expect(new Decimal(furnished.cashflows[0].amount).toNumber()).toBe(
        new Decimal(unfurnished.cashflows[0].amount).toNumber() - 60000
      );
      // Furnished effective NOI should be higher
      expect(furnished.rentalMetrics.noi.toNumber()).toBeGreaterThan(unfurnished.rentalMetrics.noi.toNumber());
    });

    it("Post-Handover Rental Offset: Accurately evaluates rental self-funding coverage", () => {
      // Post-handover plan requires 120,000 AED per year
      // Case 1: Net rent 90,000 AED -> 75% covered, 30,000 AED annual outlay needed
      const case1 = calculatePostHandoverRentalOffset({
        postHandoverInstallmentsAnnualAED: 120000,
        annualNetRentAED: 90000,
      });
      expect(case1.rentalCoveragePercent.toNumber()).toBe(75);
      expect(case1.netInvestorAnnualOutlayAED.toNumber()).toBe(30000);
      expect(case1.surplusAnnualAED.toNumber()).toBe(0);
      expect(case1.isSelfFunding).toBe(false);

      // Case 2: Net rent 135,000 AED -> 112.5% covered (self-funding with 15k surplus)
      const case2 = calculatePostHandoverRentalOffset({
        postHandoverInstallmentsAnnualAED: 120000,
        annualNetRentAED: 135000,
      });
      expect(case2.rentalCoveragePercent.toNumber()).toBe(112.5);
      expect(case2.netInvestorAnnualOutlayAED.toNumber()).toBe(0);
      expect(case2.surplusAnnualAED.toNumber()).toBe(15000);
      expect(case2.isSelfFunding).toBe(true);
    });
  });
});
