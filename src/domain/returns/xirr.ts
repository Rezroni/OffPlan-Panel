import { Decimal, toDecimal } from "@/lib/decimal";

export interface DatedCashflow {
  date: string; // ISO date 'YYYY-MM-DD'
  amount: number | string | Decimal; // Negative for outflows (investments), positive for inflows (rents, resale)
}

export interface XIRRResult {
  xirr: Decimal | null; // e.g. 0.1542
  xirrPercent: Decimal | null; // e.g. 15.42%
  isValid: boolean;
  message: string;
}

/**
 * Calculates the Internal Rate of Return for non-periodic, dated cash flows (XIRR).
 * Solves: sum( C_i / (1 + r)^((d_i - d_0)/365) ) = 0.
 *
 * Implements Section 11 & Section 24 governance:
 * - Requires at least one positive and at least one negative cash flow.
 * - Does not return an arbitrary number if cash flows cannot converge or lack direction changes.
 * - Uses Newton-Raphson with bounded Bisection fallback.
 */
export function calculateXIRR(
  flows: DatedCashflow[],
  guessRate = 0.1,
  maxIterations = 100,
  tolerance = 1e-7
): XIRRResult {
  if (!flows || flows.length < 2) {
    return {
      xirr: null,
      xirrPercent: null,
      isValid: false,
      message: "At least two dated cash flows are required to compute XIRR.",
    };
  }

  // Parse and sort flows by date
  const parsed = flows.map((f) => ({
    date: new Date(f.date).getTime(),
    amount: toDecimal(f.amount).toNumber(),
  }));

  if (parsed.some((p) => isNaN(p.date) || isNaN(p.amount))) {
    return {
      xirr: null,
      xirrPercent: null,
      isValid: false,
      message: "Invalid dates or amounts provided in cash flow series.",
    };
  }

  parsed.sort((a, b) => a.date - b.date);

  const d0 = parsed[0].date;
  const timeDays = parsed.map((p) => (p.date - d0) / (1000 * 60 * 60 * 24));
  const timeYears = timeDays.map((days) => days / 365.0);
  const amounts = parsed.map((p) => p.amount);

  // Check sign changes (must have at least one negative and at least one positive)
  const hasNegative = amounts.some((a) => a < -1e-6);
  const hasPositive = amounts.some((a) => a > 1e-6);

  if (!hasNegative || !hasPositive) {
    return {
      xirr: null,
      xirrPercent: null,
      isValid: false,
      message: "Cash flow series must contain both cash outflows (negative) and cash inflows (positive).",
    };
  }

  // NPV function
  const npv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      const t = timeYears[i];
      const factor = Math.pow(1 + r, t);
      if (!isFinite(factor) || factor === 0) return NaN;
      sum += amounts[i] / factor;
    }
    return sum;
  };

  // Derivative dNPV/dr
  const dNpv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      const t = timeYears[i];
      if (t === 0) continue;
      const factor = Math.pow(1 + r, t + 1);
      if (!isFinite(factor) || factor === 0) return NaN;
      sum -= (t * amounts[i]) / factor;
    }
    return sum;
  };

  // 1. Try Newton-Raphson
  let r = guessRate;
  let newtonConverged = false;

  for (let i = 0; i < maxIterations; i++) {
    if (r <= -0.9999) {
      r = -0.99;
    }
    const val = npv(r);
    if (Math.abs(val) < tolerance) {
      newtonConverged = true;
      break;
    }
    const deriv = dNpv(r);
    if (!isFinite(deriv) || Math.abs(deriv) < 1e-12) {
      break;
    }
    const nextR = r - val / deriv;
    if (Math.abs(nextR - r) < tolerance && Math.abs(val) < tolerance * 10) {
      r = nextR;
      newtonConverged = true;
      break;
    }
    r = nextR;
  }

  // 2. Fallback to Bisection if Newton-Raphson failed or gave an absurd result
  if (!newtonConverged || !isFinite(r) || r < -0.9999) {
    let low = -0.999;
    let high = 5.0; // up to 500% annual return
    let fLow = npv(low);
    let fHigh = npv(high);

    // Expand upper bound if needed
    if (fLow * fHigh > 0) {
      for (const testHigh of [10.0, 50.0, 100.0]) {
        high = testHigh;
        fHigh = npv(high);
        if (fLow * fHigh <= 0) break;
      }
    }

    if (fLow * fHigh <= 0) {
      for (let i = 0; i < 150; i++) {
        const mid = (low + high) / 2;
        const fMid = npv(mid);
        if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
          r = mid;
          newtonConverged = true;
          break;
        }
        if (fLow * fMid < 0) {
          high = mid;
          fHigh = fMid;
        } else {
          low = mid;
          fLow = fMid;
        }
      }
    }
  }

  if (!newtonConverged || !isFinite(r) || isNaN(r)) {
    return {
      xirr: null,
      xirrPercent: null,
      isValid: false,
      message: "XIRR solver could not find a unique real rate of return for the provided cash flows.",
    };
  }

  const xirrDec = new Decimal(r);
  const xirrPercentDec = xirrDec.times(100);

  return {
    xirr: xirrDec,
    xirrPercent: xirrPercentDec,
    isValid: true,
    message: "XIRR solved successfully.",
  };
}
