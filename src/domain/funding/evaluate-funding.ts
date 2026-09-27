import { Decimal, toDecimal } from "@/lib/decimal";

export interface ScheduledCashflow {
  date: string; // ISO date 'YYYY-MM-DD'
  amount: number | string | Decimal;
  category: "initial_cash" | "inflow" | "purchase_payment" | "fee" | "reserve";
  description?: string;
}

export interface ClientFundingProfile {
  initialLiquidCash: number | string | Decimal;
  requiredReserve: number | string | Decimal;
  plannedInflows: Array<{
    date: string;
    amount: number | string | Decimal;
    label?: string;
  }>;
}

export interface OfferPaymentSchedule {
  offerId: string;
  projectName: string;
  contractPrice: number | string | Decimal;
  milestones: Array<{
    date: string;
    amount: number | string | Decimal;
    percent?: number;
    description: string;
  }>;
  fees: Array<{
    date: string;
    amount: number | string | Decimal;
    description: string;
  }>;
}

export type FundingStatus = "PASSED" | "FAILED" | "INCOMPLETE" | "NOT_SUITABLE";

export interface TimelinePoint {
  date: string;
  description: string;
  inflow: Decimal;
  payment: Decimal;
  fee: Decimal;
  cumulativeInflow: Decimal;
  cumulativePayment: Decimal;
  cumulativeFee: Decimal;
  headroom: Decimal; // available liquid cash minus reserve
  isDeficit: boolean;
}

export interface FundingEvaluationResult {
  status: FundingStatus;
  statusReason: string;
  minHeadroom: Decimal;
  deficitDate: string | null;
  deficitAmount: Decimal | null;
  peakCapitalNeeded: Decimal;
  totalPayments: Decimal;
  totalFees: Decimal;
  totalContributions: Decimal;
  timeline: TimelinePoint[];
  // Extended dual-horizon solvency fields
  flipStatus: FundingStatus;
  flipMinHeadroom: Decimal;
  flipCapitalNeeded: Decimal;
  isHandoverDeficitOnly: boolean;
  isReserveErosionOnly: boolean;
  cashRemainingAtHandover: Decimal;
}

/**
 * Evaluates client solvency along the timeline of an off-plan purchase (Section 9):
 * headroom(t) = initial_cash + cum_inflows(t) - cum_payments(t) - cum_fees(t) - reserve(t)
 */
export function evaluateFunding(
  client: ClientFundingProfile,
  offer: OfferPaymentSchedule,
  stressDelayMonths = 0
): FundingEvaluationResult {
  const initialCash = toDecimal(client.initialLiquidCash);
  const reserve = toDecimal(client.requiredReserve);
  const contractPrice = toDecimal(offer.contractPrice);

  // Check 1: Client has only 20% and zero future funding -> NOT_SUITABLE (Section 1 & 9)
  const initialPctOfPrice = contractPrice.isZero()
    ? new Decimal(0)
    : initialCash.dividedBy(contractPrice);

  const hasNoFutureInflows =
    client.plannedInflows.length === 0 ||
    client.plannedInflows.every((inf) => toDecimal(inf.amount).isZero());

  if (initialPctOfPrice.lessThanOrEqualTo(0.25) && hasNoFutureInflows) {
    // Total price is not covered
    const totalPaymentsExpected = offer.milestones.reduce(
      (acc, m) => acc.plus(toDecimal(m.amount)),
      new Decimal(0)
    );
    if (totalPaymentsExpected.greaterThan(initialCash)) {
      return {
        status: "NOT_SUITABLE",
        statusReason:
          "Investor has ~20% initial cash without subsequent committed cashflows. Per desk investment governance, leveraged off-plan purchase cannot be recommended.",
        minHeadroom: initialCash.minus(reserve).minus(totalPaymentsExpected),
        deficitDate: offer.milestones[1]?.date || offer.milestones[0]?.date || "unknown",
        deficitAmount: totalPaymentsExpected.minus(initialCash),
        peakCapitalNeeded: totalPaymentsExpected,
        totalPayments: totalPaymentsExpected,
        totalFees: new Decimal(0),
        totalContributions: initialCash,
        timeline: [],
        flipStatus: "NOT_SUITABLE",
        flipMinHeadroom: initialCash.minus(reserve).minus(totalPaymentsExpected),
        flipCapitalNeeded: totalPaymentsExpected,
        isHandoverDeficitOnly: false,
        isReserveErosionOnly: false,
        cashRemainingAtHandover: initialCash.minus(totalPaymentsExpected),
      };
    }
  }

  // Combine and sort all dated events
  type EventItem = {
    date: string;
    type: "inflow" | "payment" | "fee";
    amount: Decimal;
    description: string;
  };

  const events: EventItem[] = [];

  for (const inf of client.plannedInflows) {
    if (!inf.date) {
      return {
        status: "INCOMPLETE",
        statusReason: "Missing date on planned client inflow. Solvency check incomplete.",
        minHeadroom: new Decimal(0),
        deficitDate: null,
        deficitAmount: null,
        peakCapitalNeeded: new Decimal(0),
        totalPayments: new Decimal(0),
        totalFees: new Decimal(0),
        totalContributions: new Decimal(0),
        timeline: [],
        flipStatus: "INCOMPLETE",
        flipMinHeadroom: new Decimal(0),
        flipCapitalNeeded: new Decimal(0),
        isHandoverDeficitOnly: false,
        isReserveErosionOnly: false,
        cashRemainingAtHandover: new Decimal(0),
      };
    }
    events.push({
      date: inf.date,
      type: "inflow",
      amount: toDecimal(inf.amount),
      description: inf.label || "Client inflow",
    });
  }

  for (const m of offer.milestones) {
    if (!m.date || m.amount === null || m.amount === undefined) {
      return {
        status: "INCOMPLETE",
        statusReason: `Incomplete milestone details on offer: ${m.description}`,
        minHeadroom: new Decimal(0),
        deficitDate: null,
        deficitAmount: null,
        peakCapitalNeeded: new Decimal(0),
        totalPayments: new Decimal(0),
        totalFees: new Decimal(0),
        totalContributions: new Decimal(0),
        timeline: [],
        flipStatus: "INCOMPLETE",
        flipMinHeadroom: new Decimal(0),
        flipCapitalNeeded: new Decimal(0),
        isHandoverDeficitOnly: false,
        isReserveErosionOnly: false,
        cashRemainingAtHandover: new Decimal(0),
      };
    }
    // Apply stress delay if applicable to handover milestones
    let milestoneDate = m.date;
    if (stressDelayMonths > 0 && m.description.toLowerCase().includes("handover")) {
      const d = new Date(m.date);
      d.setMonth(d.getMonth() + stressDelayMonths);
      milestoneDate = d.toISOString().slice(0, 10);
    }
    events.push({
      date: milestoneDate,
      type: "payment",
      amount: toDecimal(m.amount),
      description: m.description,
    });
  }

  for (const fee of offer.fees) {
    events.push({
      date: fee.date,
      type: "fee",
      amount: toDecimal(fee.amount),
      description: fee.description,
    });
  }

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  let cumInflow = initialCash;
  let cumPayment = new Decimal(0);
  let cumFee = new Decimal(0);
  let minHeadroom = initialCash.minus(reserve);
  let flipMinHeadroom = initialCash.minus(reserve);
  let flipCapitalNeeded = new Decimal(0);
  let hasPreHandoverDeficit = false;
  let firstDeficitDate: string | null = null;
  let maxDeficitAmount = new Decimal(0);

  const timeline: TimelinePoint[] = [];

  for (const ev of events) {
    if (ev.type === "inflow") cumInflow = cumInflow.plus(ev.amount);
    if (ev.type === "payment") cumPayment = cumPayment.plus(ev.amount);
    if (ev.type === "fee") cumFee = cumFee.plus(ev.amount);

    const isHandoverEvent = ev.description.toLowerCase().includes("handover");
    const headroom = cumInflow.minus(cumPayment).minus(cumFee).minus(reserve);
    const isDeficit = headroom.isNegative();

    if (!isHandoverEvent) {
      flipCapitalNeeded = cumPayment.plus(cumFee);
      if (headroom.lessThan(flipMinHeadroom)) {
        flipMinHeadroom = headroom;
      }
      if (isDeficit) {
        hasPreHandoverDeficit = true;
      }
    }

    if (isDeficit) {
      if (!firstDeficitDate) firstDeficitDate = ev.date;
      const deficit = headroom.abs();
      if (deficit.greaterThan(maxDeficitAmount)) {
        maxDeficitAmount = deficit;
      }
    }

    if (headroom.lessThan(minHeadroom)) {
      minHeadroom = headroom;
    }

    timeline.push({
      date: ev.date,
      description: ev.description,
      inflow: ev.type === "inflow" ? ev.amount : new Decimal(0),
      payment: ev.type === "payment" ? ev.amount : new Decimal(0),
      fee: ev.type === "fee" ? ev.amount : new Decimal(0),
      cumulativeInflow: cumInflow,
      cumulativePayment: cumPayment,
      cumulativeFee: cumFee,
      headroom,
      isDeficit,
    });
  }

  const isFailed = minHeadroom.isNegative();
  const isHandoverDeficitOnly = isFailed && !hasPreHandoverDeficit;
  const cashRemainingAtHandover = cumInflow.minus(cumPayment).minus(cumFee);
  const isReserveErosionOnly = isFailed && cashRemainingAtHandover.greaterThanOrEqualTo(0);
  const flipStatus: FundingStatus = flipMinHeadroom.isNegative() ? "FAILED" : "PASSED";

  let statusReason = "Solvency confirmed across all payment milestones with required liquidity reserve intact.";
  if (isFailed) {
    if (isHandoverDeficitOnly && isReserveErosionOnly) {
      statusReason = `Developer payments are 100% covered (+${cashRemainingAtHandover.toString()} AED net surplus cash), but final handover milestone taps into the protected reserve buffer by ${maxDeficitAmount.toString()} AED. Pre-handover flip strategy has zero deficit (+${flipMinHeadroom.toString()} AED headroom).`;
    } else {
      statusReason = `Funding deficit detected on ${firstDeficitDate} of ${maxDeficitAmount.toString()} AED (minimum headroom ${minHeadroom.toString()} AED).`;
    }
  }

  return {
    status: isFailed ? "FAILED" : "PASSED",
    statusReason,
    minHeadroom,
    deficitDate: firstDeficitDate,
    deficitAmount: isFailed ? maxDeficitAmount : null,
    peakCapitalNeeded: cumPayment.plus(cumFee),
    totalPayments: cumPayment,
    totalFees: cumFee,
    totalContributions: cumInflow,
    timeline,
    flipStatus,
    flipMinHeadroom,
    flipCapitalNeeded,
    isHandoverDeficitOnly,
    isReserveErosionOnly,
    cashRemainingAtHandover,
  };
}
