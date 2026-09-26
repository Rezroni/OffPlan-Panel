import { Decimal, toDecimal } from "@/lib/decimal";

export interface PeriodReturnInput {
  contractPrice: number | string | Decimal;      // P (Полная договорная цена)
  paidCapital: number | string | Decimal;        // A (Сумма, уже уплаченная в счёт цены)
  acquisitionCosts?: number | string | Decimal;  // C (Другие внесённые расходы: DLD 4%, админ сборы и т.д.)
  resalePrice: number | string | Decimal;        // S (Полная предполагаемая цена перепродажи)
  exitCosts?: number | string | Decimal;         // E (Расходы выхода: NOC, агентская комиссия продавца)
}

export interface PeriodReturnResult {
  contractPrice: Decimal;         // P
  paidCapital: Decimal;           // A
  outstandingBalance: Decimal;    // B = P - A
  acquisitionCosts: Decimal;      // C
  resalePrice: Decimal;           // S
  exitCosts: Decimal;             // E
  sellerReceipt: Decimal;         // S - B - E
  investedCash: Decimal;          // A + C
  netProfit: Decimal;             // sellerReceipt - investedCash
  returnOnInvestedCash: Decimal;  // (netProfit / investedCash) * 100
  returnOnPaidCapital: Decimal;   // (netProfit / paidCapital) * 100
}

/**
 * Calculates net profit and period ROI on invested cash according to Section 11 of the specification:
 * - seller_receipt = S - B - E
 * - invested_cash = A + C
 * - net_profit = seller_receipt - invested_cash
 * - return_on_invested_cash = net_profit / invested_cash
 */
export function calculatePeriodReturn(input: PeriodReturnInput): PeriodReturnResult {
  const P = toDecimal(input.contractPrice);
  const A = toDecimal(input.paidCapital);
  const B = Decimal.max(0, P.minus(A));
  const C = toDecimal(input.acquisitionCosts);
  const S = toDecimal(input.resalePrice);
  const E = toDecimal(input.exitCosts);

  const sellerReceipt = S.minus(B).minus(E);
  const investedCash = A.plus(C);
  const netProfit = sellerReceipt.minus(investedCash);

  const returnOnInvestedCash = investedCash.isZero()
    ? new Decimal(0)
    : netProfit.dividedBy(investedCash).times(100);

  const returnOnPaidCapital = A.isZero()
    ? new Decimal(0)
    : netProfit.dividedBy(A).times(100);

  return {
    contractPrice: P,
    paidCapital: A,
    outstandingBalance: B,
    acquisitionCosts: C,
    resalePrice: S,
    exitCosts: E,
    sellerReceipt,
    investedCash,
    netProfit,
    returnOnInvestedCash,
    returnOnPaidCapital,
  };
}

export interface BreakEvenInput {
  contractPrice: number | string | Decimal;     // P
  acquisitionCosts?: number | string | Decimal; // C
  fixedExitCosts?: number | string | Decimal;   // fixed E (например NOC)
  variableExitRate?: number | string | Decimal; // s (процент комиссии от цены продажи, например 0.02 = 2%)
}

/**
 * Calculates the exact Break-Even resale price (S_break_even) where Net Profit = 0:
 * S_break_even = (P + C + fixedExitCosts) / (1 - s)
 */
export function calculateBreakEven(input: BreakEvenInput): Decimal {
  const P = toDecimal(input.contractPrice);
  const C = toDecimal(input.acquisitionCosts);
  const fixed = toDecimal(input.fixedExitCosts);
  const s = toDecimal(input.variableExitRate); // e.g. 0.02 for 2%

  const denominator = new Decimal(1).minus(s);
  if (denominator.isZero() || denominator.isNegative()) {
    throw new Error("Invalid variable exit rate: must be less than 1.0 (100%)");
  }

  const numerator = P.plus(C).plus(fixed);
  return numerator.dividedBy(denominator);
}
