import { Decimal, toDecimal } from "@/lib/decimal";

export type AssignmentPolicy = "allowed" | "prohibited" | "conditional" | "unknown";

export interface TransferEligibilityInput {
  assignmentPolicy: AssignmentPolicy;
  minPaidPercentRequired: number; // e.g. 30 for 30% or 40 for 40%
  currentPaidAmount: number | string | Decimal;
  contractPrice: number | string | Decimal;
  adminNocFee?: number | string | Decimal;
}

export interface TransferEligibilityResult {
  isEligible: boolean;
  status: "ELIGIBLE" | "REQUIRES_TOPUP" | "PROHIBITED" | "NEEDS_VERIFICATION";
  currentPaidPercent: Decimal;
  requiredPaidPercent: Decimal;
  topupRequiredAED: Decimal;
  policy: AssignmentPolicy;
  reason: string;
}

/**
 * Validates whether an off-plan unit can be legally assigned / resold prior to handover (Section 12):
 * - Checks NOC threshold (e.g. 30% or 40% of contract price)
 * - Calculates top-up amount needed if threshold not reached
 */
export function validateTransferEligibility(input: TransferEligibilityInput): TransferEligibilityResult {
  const contractPrice = toDecimal(input.contractPrice);
  const currentPaid = toDecimal(input.currentPaidAmount);
  const requiredPercent = new Decimal(input.minPaidPercentRequired);

  const currentPaidPercent = contractPrice.isZero()
    ? new Decimal(0)
    : currentPaid.dividedBy(contractPrice).times(100);

  if (input.assignmentPolicy === "prohibited") {
    return {
      isEligible: false,
      status: "PROHIBITED",
      currentPaidPercent,
      requiredPaidPercent: requiredPercent,
      topupRequiredAED: new Decimal(0),
      policy: "prohibited",
      reason: "Contract or developer policy strictly prohibits resale prior to handover.",
    };
  }

  if (input.assignmentPolicy === "unknown") {
    return {
      isEligible: false,
      status: "NEEDS_VERIFICATION",
      currentPaidPercent,
      requiredPaidPercent: requiredPercent,
      topupRequiredAED: new Decimal(0),
      policy: "unknown",
      reason: "Assignment rules and NOC requirements have not been confirmed with developer documentation.",
    };
  }

  const minRequiredAmount = contractPrice.times(requiredPercent.dividedBy(100));
  const topupRequired = Decimal.max(0, minRequiredAmount.minus(currentPaid));

  if (topupRequired.isZero()) {
    return {
      isEligible: true,
      status: "ELIGIBLE",
      currentPaidPercent,
      requiredPaidPercent: requiredPercent,
      topupRequiredAED: new Decimal(0),
      policy: input.assignmentPolicy,
      reason: `NOC threshold of ${requiredPercent.toString()}% satisfied (currently ${currentPaidPercent.toFixed(1)}% paid). Unit is eligible for assignment.`,
    };
  }

  return {
    isEligible: false,
    status: "REQUIRES_TOPUP",
    currentPaidPercent,
    requiredPaidPercent: requiredPercent,
    topupRequiredAED: topupRequired,
    policy: input.assignmentPolicy,
    reason: `Additional ${topupRequired.toFixed(0)} AED must be paid to developer to reach the ${requiredPercent.toString()}% NOC threshold for transfer approval.`,
  };
}
