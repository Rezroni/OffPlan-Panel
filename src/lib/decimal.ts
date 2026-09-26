import Decimal from "decimal.js";

// Set precision for financial arithmetic
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(val: number | string | Decimal | null | undefined): Decimal {
  if (val === null || val === undefined) return new Decimal(0);
  return new Decimal(val);
}

export function formatAED(val: number | string | Decimal | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "object" ? val.toNumber() : Number(val);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercent(val: number | string | Decimal | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "object" ? val.toNumber() : Number(val);
  if (isNaN(num)) return "—";
  return `${num >= 0 ? "" : ""}${num.toFixed(decimals)}%`;
}

export function formatSqft(val: number | string | Decimal | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "object" ? val.toNumber() : Number(val);
  if (isNaN(num)) return "—";
  return `${Math.round(num).toLocaleString()} sq.ft.`;
}
