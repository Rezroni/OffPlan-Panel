import { Decimal, toDecimal } from "@/lib/decimal";

export type PaymentPlanPreset = "60/40" | "70/30" | "80/20" | "50/50" | "40/60_post_handover";

export interface MilestoneTemplate {
  percent: number; // e.g. 20 for 20%
  label: string; // e.g. "Down Payment / Booking"
  dldMilestone: string; // e.g. "Immediate Registration"
  relativeMonth: number; // approximate month from start (for baseline)
  isConstructionTied: boolean; // if true, delayed by stress delay
}

export interface PaymentMilestone {
  date: string; // YYYY-MM-DD
  percent: number;
  amountAED: Decimal;
  label: string;
  dldMilestone: string;
  isConstructionTied: boolean;
  isHandover: boolean;
  isPostHandover: boolean;
}

export interface GeneratedPaymentPlan {
  preset: PaymentPlanPreset;
  contractPrice: Decimal;
  totalPercent: number;
  totalAmountAED: Decimal;
  bookingAmountAED: Decimal;
  handoverAmountAED: Decimal;
  preHandoverPercent: number;
  handoverPercent: number;
  postHandoverPercent: number;
  stressDelayMonths: number;
  milestones: PaymentMilestone[];
}

export const PRESET_TEMPLATES: Record<PaymentPlanPreset, { title: string; stages: MilestoneTemplate[] }> = {
  "60/40": {
    title: "60/40 Standard Construction Linked",
    stages: [
      { percent: 20, label: "Booking & Down Payment", dldMilestone: "Registration", relativeMonth: 0, isConstructionTied: false },
      { percent: 10, label: "1st Installment", dldMilestone: "Substructure / 20% Construction", relativeMonth: 6, isConstructionTied: true },
      { percent: 10, label: "2nd Installment", dldMilestone: "Superstructure / 40% Construction", relativeMonth: 12, isConstructionTied: true },
      { percent: 10, label: "3rd Installment", dldMilestone: "Façade / 60% Construction", relativeMonth: 18, isConstructionTied: true },
      { percent: 10, label: "4th Installment", dldMilestone: "Internal Fitout / 70% Construction", relativeMonth: 24, isConstructionTied: true },
      { percent: 40, label: "Final Installment on Handover", dldMilestone: "Building Completion Certificate (100%)", relativeMonth: 30, isConstructionTied: true },
    ],
  },
  "70/30": {
    title: "70/30 Extended Phased Plan",
    stages: [
      { percent: 20, label: "Booking & Down Payment", dldMilestone: "Registration", relativeMonth: 0, isConstructionTied: false },
      { percent: 10, label: "1st Installment", dldMilestone: "Foundation / 15% Construction", relativeMonth: 5, isConstructionTied: true },
      { percent: 10, label: "2nd Installment", dldMilestone: "Structure / 35% Construction", relativeMonth: 10, isConstructionTied: true },
      { percent: 10, label: "3rd Installment", dldMilestone: "MEP Rough-in / 50% Construction", relativeMonth: 15, isConstructionTied: true },
      { percent: 10, label: "4th Installment", dldMilestone: "Enclosure / 65% Construction", relativeMonth: 20, isConstructionTied: true },
      { percent: 10, label: "5th Installment", dldMilestone: "Finishes / 80% Construction", relativeMonth: 25, isConstructionTied: true },
      { percent: 30, label: "Final Installment on Handover", dldMilestone: "Building Completion Certificate (100%)", relativeMonth: 30, isConstructionTied: true },
    ],
  },
  "80/20": {
    title: "80/20 Fast-Track Plan",
    stages: [
      { percent: 20, label: "Booking & Down Payment", dldMilestone: "Registration", relativeMonth: 0, isConstructionTied: false },
      { percent: 15, label: "1st Installment", dldMilestone: "Substructure / 25% Construction", relativeMonth: 6, isConstructionTied: true },
      { percent: 15, label: "2nd Installment", dldMilestone: "Mid-Rise Structure / 50% Construction", relativeMonth: 12, isConstructionTied: true },
      { percent: 15, label: "3rd Installment", dldMilestone: "Façade & MEP / 75% Construction", relativeMonth: 18, isConstructionTied: true },
      { percent: 15, label: "4th Installment", dldMilestone: "Internal Inspections / 90% Construction", relativeMonth: 24, isConstructionTied: true },
      { percent: 20, label: "Final on Handover", dldMilestone: "Building Completion Certificate (100%)", relativeMonth: 30, isConstructionTied: true },
    ],
  },
  "50/50": {
    title: "50/50 Balanced Construction Plan",
    stages: [
      { percent: 20, label: "Booking & Down Payment", dldMilestone: "Registration", relativeMonth: 0, isConstructionTied: false },
      { percent: 10, label: "1st Installment", dldMilestone: "Piling & Shoring / 20% Construction", relativeMonth: 6, isConstructionTied: true },
      { percent: 10, label: "2nd Installment", dldMilestone: "Structure / 50% Construction", relativeMonth: 14, isConstructionTied: true },
      { percent: 10, label: "3rd Installment", dldMilestone: "Finishing / 75% Construction", relativeMonth: 22, isConstructionTied: true },
      { percent: 50, label: "Final Installment on Handover", dldMilestone: "Building Completion Certificate (100%)", relativeMonth: 30, isConstructionTied: true },
    ],
  },
  "40/60_post_handover": {
    title: "40/60 Post-Handover (2 Years Post-Completion)",
    stages: [
      { percent: 20, label: "Booking & Down Payment", dldMilestone: "Registration", relativeMonth: 0, isConstructionTied: false },
      { percent: 10, label: "1st Installment", dldMilestone: "Structure / 40% Construction", relativeMonth: 10, isConstructionTied: true },
      { percent: 10, label: "2nd Installment", dldMilestone: "Façade / 70% Construction", relativeMonth: 20, isConstructionTied: true },
      { percent: 10, label: "On Handover (Key Release)", dldMilestone: "Building Completion Certificate (100%)", relativeMonth: 28, isConstructionTied: true },
      { percent: 25, label: "Post-Handover Year 1", dldMilestone: "Post-Completion Month 12", relativeMonth: 40, isConstructionTied: true },
      { percent: 25, label: "Post-Handover Year 2", dldMilestone: "Post-Completion Month 24", relativeMonth: 52, isConstructionTied: true },
    ],
  },
};

/**
 * Builds a concrete, calendar-dated payment plan linked to DLD construction milestones.
 * Supports delay stress testing (+6m, +12m) which shifts construction-tied dates while keeping
 * initial calendar milestones stable.
 */
export function generatePaymentPlan(
  contractPriceInput: number | string | Decimal,
  preset: PaymentPlanPreset = "60/40",
  startDateStr = "2026-10-01",
  stressDelayMonths = 0
): GeneratedPaymentPlan {
  const price = toDecimal(contractPriceInput);
  const template = PRESET_TEMPLATES[preset] || PRESET_TEMPLATES["60/40"];
  const startDate = new Date(startDateStr);

  let preHandoverPct = 0;
  let handoverPct = 0;
  let postHandoverPct = 0;

  const milestones: PaymentMilestone[] = template.stages.map((stage) => {
    const isHandover = stage.label.toLowerCase().includes("handover") && !stage.label.toLowerCase().includes("post");
    const isPost = stage.label.toLowerCase().includes("post-handover") || stage.dldMilestone.toLowerCase().includes("post-completion");

    if (isHandover) {
      handoverPct += stage.percent;
    } else if (isPost) {
      postHandoverPct += stage.percent;
    } else {
      preHandoverPct += stage.percent;
    }

    // Determine calendar date
    const d = new Date(startDate);
    let monthOffset = stage.relativeMonth;
    if (stage.isConstructionTied && stressDelayMonths > 0) {
      monthOffset += stressDelayMonths;
    }
    d.setMonth(d.getMonth() + monthOffset);
    const dateStr = d.toISOString().slice(0, 10);

    const amount = price.times(stage.percent).dividedBy(100);

    return {
      date: dateStr,
      percent: stage.percent,
      amountAED: amount,
      label: stage.label,
      dldMilestone: stage.dldMilestone,
      isConstructionTied: stage.isConstructionTied,
      isHandover,
      isPostHandover: isPost,
    };
  });

  const totalPercent = milestones.reduce((sum, m) => sum + m.percent, 0);
  const totalAmountAED = milestones.reduce((sum, m) => sum.plus(m.amountAED), new Decimal(0));
  const bookingAmountAED = milestones[0]?.amountAED || new Decimal(0);
  const handoverAmountAED = milestones.find((m) => m.isHandover)?.amountAED || new Decimal(0);

  return {
    preset,
    contractPrice: price,
    totalPercent,
    totalAmountAED,
    bookingAmountAED,
    handoverAmountAED,
    preHandoverPercent: preHandoverPct,
    handoverPercent: handoverPct,
    postHandoverPercent: postHandoverPct,
    stressDelayMonths,
    milestones,
  };
}
