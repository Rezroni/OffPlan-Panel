import { Decimal, toDecimal } from "@/lib/decimal";

export interface TransactionCostInput {
  contractPrice: number | string | Decimal;
  dldFeeRate?: number | string | Decimal; // Default 4% (0.04)
  oqoodCertificateFeeAED?: number | string | Decimal; // Default 580 AED
  trusteeFeeAED?: number | string | Decimal; // Default 4,000 AED + VAT (5%) = 4,200 AED for >= 500k AED; 2,000 + VAT for < 500k
  developerNocFeeAED?: number | string | Decimal; // Default up to 5,000 AED (standard 5,000 AED)
  legalBrokerageFeeRate?: number | string | Decimal; // Default 0% or custom (e.g. 2%)
  legalBrokerageFlatAED?: number | string | Decimal; // Optional flat brokerage/admin fee
  vatRate?: number | string | Decimal; // Default 5% (0.05)
}

export interface TransactionCostBreakdown {
  contractPrice: Decimal;
  dldRegistrationFeeAED: Decimal; // 4% of contract price
  oqoodCertificateFeeAED: Decimal; // Standard 580 AED
  registrationTrusteeFeeAED: Decimal; // Base fee (4,000 or 2,000)
  trusteeVatAED: Decimal; // 5% VAT on trustee fee
  totalTrusteeFeeAED: Decimal; // Base + VAT (e.g. 4,200 AED)
  developerNocFeeAED: Decimal; // Developer NOC fee (up to 5,000 AED)
  legalBrokerageFeeAED: Decimal; // Legal / agency fee
  totalTransactionFeesAED: Decimal; // Sum of all fees
  totalAcquisitionCostAED: Decimal; // contractPrice + totalTransactionFeesAED
  feesPercentOfPrice: Decimal; // (totalTransactionFeesAED / contractPrice) * 100
}

/**
 * Calculates mandatory Dubai Land Department (DLD) and auxiliary transaction costs:
 * 1. DLD Registration Fee: 4% of contract price.
 * 2. DLD Certificate / Oqood issuance fee: AED 580.
 * 3. Registration Trustee Fee: AED 4,000 + 5% VAT (AED 4,200) for properties >= 500,000 AED;
 *    AED 2,000 + 5% VAT (AED 2,100) for properties < 500,000 AED.
 * 4. Developer NOC Fee: up to AED 5,000.
 * 5. Optional Legal & Brokerage processing fees.
 */
export function calculateTransactionCosts(input: TransactionCostInput): TransactionCostBreakdown {
  const price = toDecimal(input.contractPrice);
  const dldRate = input.dldFeeRate !== undefined ? toDecimal(input.dldFeeRate) : new Decimal(0.04);
  const oqoodFee = input.oqoodCertificateFeeAED !== undefined ? toDecimal(input.oqoodCertificateFeeAED) : new Decimal(580);
  const vatRate = input.vatRate !== undefined ? toDecimal(input.vatRate) : new Decimal(0.05);

  // DLD 4%
  const dldFee = price.times(dldRate);

  // Trustee Fee: 4,000 AED if price >= 500,000; 2,000 AED if price < 500,000
  let baseTrustee: Decimal;
  if (input.trusteeFeeAED !== undefined) {
    baseTrustee = toDecimal(input.trusteeFeeAED);
  } else {
    baseTrustee = price.greaterThanOrEqualTo(500000) ? new Decimal(4000) : new Decimal(2000);
  }
  const trusteeVat = baseTrustee.times(vatRate);
  const totalTrustee = baseTrustee.plus(trusteeVat);

  // Developer NOC fee (typically up to 5,000 AED)
  const nocFee = input.developerNocFeeAED !== undefined
    ? toDecimal(input.developerNocFeeAED)
    : new Decimal(5000);

  // Legal / Brokerage
  const legalRate = input.legalBrokerageFeeRate !== undefined ? toDecimal(input.legalBrokerageFeeRate) : new Decimal(0);
  const legalFlat = input.legalBrokerageFlatAED !== undefined ? toDecimal(input.legalBrokerageFlatAED) : new Decimal(0);
  const legalFee = price.times(legalRate).plus(legalFlat);

  // Total fees
  const totalFees = dldFee.plus(oqoodFee).plus(totalTrustee).plus(nocFee).plus(legalFee);
  const totalAcquisition = price.plus(totalFees);

  const feesPercent = price.isZero()
    ? new Decimal(0)
    : totalFees.dividedBy(price).times(100);

  return {
    contractPrice: price,
    dldRegistrationFeeAED: dldFee,
    oqoodCertificateFeeAED: oqoodFee,
    registrationTrusteeFeeAED: baseTrustee,
    trusteeVatAED: trusteeVat,
    totalTrusteeFeeAED: totalTrustee,
    developerNocFeeAED: nocFee,
    legalBrokerageFeeAED: legalFee,
    totalTransactionFeesAED: totalFees,
    totalAcquisitionCostAED: totalAcquisition,
    feesPercentOfPrice: feesPercent,
  };
}
