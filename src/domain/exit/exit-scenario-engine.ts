import { Decimal, toDecimal } from "@/lib/decimal";
import { validateTransferEligibility, AssignmentPolicy, TransferEligibilityResult } from "./transfer-eligibility";
import { calculateBreakEven } from "../returns/calculate-period-return";
import { calculateRentalScenario, RentalScenarioResult } from "../returns/calculate-rental-scenario";
import { calculateXIRR, XIRRResult, DatedCashflow } from "../returns/xirr";
import { calculateTransactionCosts, TransactionCostBreakdown } from "../funding/transaction-costs";

// ---------------------------------------------------------------------------
// Strategy A: Assignment Resale Types & Engine
// ---------------------------------------------------------------------------

export interface AssignmentScenarioResult {
  label: string; // e.g. "Bearish (-10%)"
  appreciationPercent: number; // e.g. -10, +10, +20
  resalePriceAED: Decimal; // S
  resalePsfAED: Decimal; // S / area
  fixedExitCostsAED: Decimal; // NOC fee
  variableExitCostsAED: Decimal; // Agency fee (e.g. 2%)
  totalExitCostsAED: Decimal; // E
  outstandingBalanceAED: Decimal; // B = P - A
  sellerReceiptAED: Decimal; // S - B - E
  investedCashAED: Decimal; // A + C + topupRequired
  netProfitAED: Decimal; // sellerReceipt - investedCash
  cashOnCashRoiPercent: Decimal; // (netProfit / investedCash) * 100
}

export interface AssignmentResaleAnalysis {
  contractPriceAED: Decimal;
  areaSqft: Decimal;
  paidCapitalAED: Decimal;
  paidPercent: Decimal;
  acquisitionCostsAED: Decimal;
  eligibility: TransferEligibilityResult;
  topupRequiredAED: Decimal;
  breakEvenResalePriceAED: Decimal;
  breakEvenPsfAED: Decimal;
  scenarios: AssignmentScenarioResult[];
}

export interface AssignmentResaleInput {
  contractPrice: number | string | Decimal;
  areaSqft: number | string | Decimal;
  paidCapital: number | string | Decimal;
  assignmentPolicy?: AssignmentPolicy;
  minPaidPercentRequired?: number; // e.g. 34 for 34%, 40 for 40%
  acquisitionCosts?: number | string | Decimal;
  developerNocFee?: number | string | Decimal; // Default 5,000 AED
  resaleBrokerageRate?: number | string | Decimal; // Default 2% (0.02)
  customResalePrice?: number | string | Decimal;
}

export function evaluateAssignmentResale(input: AssignmentResaleInput): AssignmentResaleAnalysis {
  const P = toDecimal(input.contractPrice);
  const area = toDecimal(input.areaSqft);
  const A = toDecimal(input.paidCapital);
  const C = input.acquisitionCosts !== undefined
    ? toDecimal(input.acquisitionCosts)
    : calculateTransactionCosts({ contractPrice: P }).totalTransactionFeesAED;

  const nocFee = input.developerNocFee !== undefined ? toDecimal(input.developerNocFee) : new Decimal(5000);
  const brokerRate = input.resaleBrokerageRate !== undefined ? toDecimal(input.resaleBrokerageRate) : new Decimal(0.02);
  const minPaidPct = input.minPaidPercentRequired || 34; // default 34% or 40%
  const policy = input.assignmentPolicy || "allowed";

  // Check eligibility and top-up required
  const eligibility = validateTransferEligibility({
    contractPrice: P,
    currentPaidAmount: A,
    minPaidPercentRequired: minPaidPct,
    assignmentPolicy: policy,
  });

  const topupRequired = eligibility.topupRequiredAED;
  const effectivePaidCapital = A.plus(topupRequired);
  const investedCash = effectivePaidCapital.plus(C);
  const outstandingBalance = Decimal.max(0, P.minus(effectivePaidCapital));

  // Break-even price: S_be = (P + C + fixedExit) / (1 - brokerRate)
  const breakEvenPrice = calculateBreakEven({
    contractPrice: P,
    acquisitionCosts: C,
    fixedExitCosts: nocFee,
    variableExitRate: brokerRate,
  });

  const breakEvenPsf = area.isZero() ? new Decimal(0) : breakEvenPrice.dividedBy(area);

  // Scenarios to calculate
  const scenarioConfigs = [
    { label: "Bearish Exit (-10%)", factor: 0.90, pct: -10 },
    { label: "Baseline Exit (+10%)", factor: 1.10, pct: 10 },
    { label: "Bullish Exit (+20%)", factor: 1.20, pct: 20 },
  ];

  if (input.customResalePrice !== undefined) {
    const customS = toDecimal(input.customResalePrice);
    const customPct = P.isZero() ? 0 : customS.minus(P).dividedBy(P).times(100).toNumber();
    scenarioConfigs.push({
      label: `Custom Price (${customPct >= 0 ? "+" : ""}${customPct.toFixed(1)}%)`,
      factor: P.isZero() ? 1 : customS.dividedBy(P).toNumber(),
      pct: customPct,
    });
  }

  const scenarios: AssignmentScenarioResult[] = scenarioConfigs.map((cfg) => {
    const resalePrice = P.times(cfg.factor);
    const resalePsf = area.isZero() ? new Decimal(0) : resalePrice.dividedBy(area);
    const variableCosts = resalePrice.times(brokerRate);
    const totalExitCosts = nocFee.plus(variableCosts);
    const sellerReceipt = resalePrice.minus(outstandingBalance).minus(totalExitCosts);
    const netProfit = sellerReceipt.minus(investedCash);
    const cashOnCashRoi = investedCash.isZero()
      ? new Decimal(0)
      : netProfit.dividedBy(investedCash).times(100);

    return {
      label: cfg.label,
      appreciationPercent: cfg.pct,
      resalePriceAED: resalePrice,
      resalePsfAED: resalePsf,
      fixedExitCostsAED: nocFee,
      variableExitCostsAED: variableCosts,
      totalExitCostsAED: totalExitCosts,
      outstandingBalanceAED: outstandingBalance,
      sellerReceiptAED: sellerReceipt,
      investedCashAED: investedCash,
      netProfitAED: netProfit,
      cashOnCashRoiPercent: cashOnCashRoi,
    };
  });

  const paidPercent = P.isZero() ? new Decimal(0) : A.dividedBy(P).times(100);

  return {
    contractPriceAED: P,
    areaSqft: area,
    paidCapitalAED: A,
    paidPercent,
    acquisitionCostsAED: C,
    eligibility,
    topupRequiredAED: topupRequired,
    breakEvenResalePriceAED: breakEvenPrice,
    breakEvenPsfAED: breakEvenPsf,
    scenarios,
  };
}

// ---------------------------------------------------------------------------
// Strategy B: Handover & Hold (Rental & XIRR) Types & Engine
// ---------------------------------------------------------------------------

export interface HandoverAndHoldInput {
  contractPrice: number | string | Decimal;
  totalAcquisitionCost?: number | string | Decimal; // if omitted, uses contractPrice + DLD fees
  annualGrossRent: number | string | Decimal;
  furnishingCostAED?: number | string | Decimal; // Fitout / furnishing pack
  serviceChargesAnnual?: number | string | Decimal;
  vacancyRate?: number | string | Decimal; // e.g. 0.05 (5%)
  managementFeeRate?: number | string | Decimal; // e.g. 0.05 to 0.08 (5%-8%)
  maintenanceAnnual?: number | string | Decimal;
  holdingYears?: number; // 1, 3, or 5 years
  annualCapitalAppreciationRate?: number | string | Decimal; // e.g. 0.03 (3% per year)
  terminalResaleBrokerRate?: number | string | Decimal; // e.g. 0.02 (2%)
  handoverDateStr?: string; // YYYY-MM-DD
}

export interface HandoverAndHoldAnalysis {
  rentalMetrics: RentalScenarioResult;
  holdingYears: number;
  furnishingCostAED: Decimal;
  terminalResalePriceAED: Decimal;
  terminalNetExitReceiptAED: Decimal;
  totalCumulativeNOIAED: Decimal;
  totalNetProfitAED: Decimal;
  xirrResult: XIRRResult;
  cashflows: DatedCashflow[];
}

export function evaluateHandoverAndHold(input: HandoverAndHoldInput): HandoverAndHoldAnalysis {
  const P = toDecimal(input.contractPrice);
  const furnishingCost = input.furnishingCostAED ? toDecimal(input.furnishingCostAED) : new Decimal(0);
  const baseCost = input.totalAcquisitionCost !== undefined
    ? toDecimal(input.totalAcquisitionCost)
    : calculateTransactionCosts({ contractPrice: P }).totalAcquisitionCostAED;
  const totalCost = baseCost.plus(furnishingCost);

  const rentalMetrics = calculateRentalScenario({
    purchasePrice: P,
    totalAcquisitionCost: totalCost,
    annualGrossRent: input.annualGrossRent,
    vacancyRate: input.vacancyRate || 0.05,
    serviceChargesAnnual: input.serviceChargesAnnual || 0,
    managementFeeRate: input.managementFeeRate || 0.05,
    maintenanceAnnual: input.maintenanceAnnual || 0,
  });

  const holdingYears = input.holdingYears || 3;
  const growthRate = input.annualCapitalAppreciationRate !== undefined
    ? toDecimal(input.annualCapitalAppreciationRate)
    : new Decimal(0.03); // 3% per year
  const terminalBrokerRate = input.terminalResaleBrokerRate !== undefined
    ? toDecimal(input.terminalResaleBrokerRate)
    : new Decimal(0.02);

  const handoverDate = input.handoverDateStr ? new Date(input.handoverDateStr) : new Date("2028-12-01");

  // Terminal price = P * (1 + g)^holdingYears
  const appreciationMultiplier = new Decimal(1).plus(growthRate).pow(holdingYears);
  const terminalResalePrice = P.times(appreciationMultiplier);
  const terminalBrokerCost = terminalResalePrice.times(terminalBrokerRate);
  const terminalNetReceipt = terminalResalePrice.minus(terminalBrokerCost);

  // Build dated cash flows for XIRR
  const cashflows: DatedCashflow[] = [];

  // Day 0 (Handover / final acquisition completed): Total cash deployed
  const day0Str = handoverDate.toISOString().slice(0, 10);
  cashflows.push({
    date: day0Str,
    amount: totalCost.negated(), // negative outflow
  });

  let totalCumulativeNOI = new Decimal(0);

  // Intermediate annual rental income
  for (let year = 1; year <= holdingYears; year++) {
    const rentDate = new Date(handoverDate);
    rentDate.setFullYear(rentDate.getFullYear() + year);
    const dateStr = rentDate.toISOString().slice(0, 10);

    totalCumulativeNOI = totalCumulativeNOI.plus(rentalMetrics.noi);

    if (year === holdingYears) {
      // Final year receives both annual NOI and terminal liquidation receipt
      const finalFlow = rentalMetrics.noi.plus(terminalNetReceipt);
      cashflows.push({
        date: dateStr,
        amount: finalFlow,
      });
    } else {
      cashflows.push({
        date: dateStr,
        amount: rentalMetrics.noi,
      });
    }
  }

  // Total net profit over hold
  // total profit = total cumulative NOI + terminalNetReceipt - totalCost
  const totalNetProfit = totalCumulativeNOI.plus(terminalNetReceipt).minus(totalCost);

  // Solve for XIRR
  const xirrResult = calculateXIRR(cashflows);

  return {
    rentalMetrics,
    holdingYears,
    furnishingCostAED: furnishingCost,
    terminalResalePriceAED: terminalResalePrice,
    terminalNetExitReceiptAED: terminalNetReceipt,
    totalCumulativeNOIAED: totalCumulativeNOI,
    totalNetProfitAED: totalNetProfit,
    xirrResult,
    cashflows,
  };
}

// ---------------------------------------------------------------------------
// Target ROI Solver & Post-Handover Offset Helpers
// ---------------------------------------------------------------------------

export interface TargetRoiSolverInput {
  contractPrice: number | string | Decimal;
  areaSqft: number | string | Decimal;
  paidCapital: number | string | Decimal;
  targetRoiPercent: number | string | Decimal; // e.g. 25 for 25%
  acquisitionCosts?: number | string | Decimal;
  developerNocFee?: number | string | Decimal;
  resaleBrokerageRate?: number | string | Decimal;
  minPaidPercentRequired?: number;
  assignmentPolicy?: AssignmentPolicy;
}

export interface TargetRoiSolverResult {
  targetResalePriceAED: Decimal;
  targetResalePsfAED: Decimal;
  targetNetProfitAED: Decimal;
  requiredAppreciationPercent: Decimal;
  investedCashAED: Decimal;
}

/**
 * Solves for the exact Resale Price (S) and Resale PSF needed to achieve a target Cash-on-Cash ROI:
 * investedCash = A + C + topupRequired
 * targetNetProfit = investedCash * (targetRoiPercent / 100)
 * targetReceipt = investedCash + targetNetProfit
 * S_target = (targetReceipt + B + fixedExit) / (1 - brokerRate)
 */
export function solveTargetResalePriceForRoi(input: TargetRoiSolverInput): TargetRoiSolverResult {
  const P = toDecimal(input.contractPrice);
  const area = toDecimal(input.areaSqft);
  const A = toDecimal(input.paidCapital);
  const targetRoi = toDecimal(input.targetRoiPercent);
  const C = input.acquisitionCosts !== undefined
    ? toDecimal(input.acquisitionCosts)
    : calculateTransactionCosts({ contractPrice: P }).totalTransactionFeesAED;
  const nocFee = input.developerNocFee !== undefined ? toDecimal(input.developerNocFee) : new Decimal(5000);
  const brokerRate = input.resaleBrokerageRate !== undefined ? toDecimal(input.resaleBrokerageRate) : new Decimal(0.02);
  const minPaidPct = input.minPaidPercentRequired || 34;

  const eligibility = validateTransferEligibility({
    contractPrice: P,
    currentPaidAmount: A,
    minPaidPercentRequired: minPaidPct,
    assignmentPolicy: input.assignmentPolicy || "allowed",
  });

  const effectivePaid = A.plus(eligibility.topupRequiredAED);
  const investedCash = effectivePaid.plus(C);
  const B = Decimal.max(0, P.minus(effectivePaid));

  const targetNetProfit = investedCash.times(targetRoi.dividedBy(100));
  const targetSellerReceipt = investedCash.plus(targetNetProfit);

  const denominator = new Decimal(1).minus(brokerRate);
  const targetResalePrice = targetSellerReceipt.plus(B).plus(nocFee).dividedBy(denominator);
  const targetResalePsf = area.isZero() ? new Decimal(0) : targetResalePrice.dividedBy(area);
  const requiredAppreciation = P.isZero() ? new Decimal(0) : targetResalePrice.minus(P).dividedBy(P).times(100);

  return {
    targetResalePriceAED: targetResalePrice,
    targetResalePsfAED: targetResalePsf,
    targetNetProfitAED: targetNetProfit,
    requiredAppreciationPercent: requiredAppreciation,
    investedCashAED: investedCash,
  };
}

export interface PostHandoverOffsetInput {
  postHandoverInstallmentsAnnualAED: number | string | Decimal;
  annualNetRentAED: number | string | Decimal;
}

export interface PostHandoverOffsetResult {
  annualNetRentAED: Decimal;
  annualInstallmentsAED: Decimal;
  rentalCoveragePercent: Decimal; // (annualNetRent / annualInstallments) * 100
  netInvestorAnnualOutlayAED: Decimal; // max(0, installments - netRent)
  surplusAnnualAED: Decimal; // max(0, netRent - installments)
  isSelfFunding: boolean;
}

/**
 * Computes how much of the post-handover payment plan is offset by incoming rental income.
 */
export function calculatePostHandoverRentalOffset(input: PostHandoverOffsetInput): PostHandoverOffsetResult {
  const installments = toDecimal(input.postHandoverInstallmentsAnnualAED);
  const netRent = toDecimal(input.annualNetRentAED);

  const coveragePercent = installments.isZero()
    ? new Decimal(100)
    : netRent.dividedBy(installments).times(100);

  const outlay = Decimal.max(0, installments.minus(netRent));
  const surplus = Decimal.max(0, netRent.minus(installments));

  return {
    annualNetRentAED: netRent,
    annualInstallmentsAED: installments,
    rentalCoveragePercent: coveragePercent,
    netInvestorAnnualOutlayAED: outlay,
    surplusAnnualAED: surplus,
    isSelfFunding: coveragePercent.greaterThanOrEqualTo(100),
  };
}

