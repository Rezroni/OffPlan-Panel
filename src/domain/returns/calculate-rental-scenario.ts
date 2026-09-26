import { Decimal, toDecimal } from "@/lib/decimal";

export interface RentalScenarioInput {
  purchasePrice: number | string | Decimal;         // Цена покупки квартиры
  totalAcquisitionCost?: number | string | Decimal; // Полная стоимость (цена + сборы + меблировка/fitout)
  annualGrossRent: number | string | Decimal;       // Потенциальная годовая валовая аренда
  vacancyRate?: number | string | Decimal;          // Простой/вакансия (например 0.05 = 5%)
  serviceChargesAnnual?: number | string | Decimal; // Ежегодные сервисные сборы (DLD OA Service charge)
  managementFeeRate?: number | string | Decimal;    // Комиссия УК (например 0.08 = 8% от сбора)
  maintenanceAnnual?: number | string | Decimal;    // Ремонт/страховка
}

export interface RentalScenarioResult {
  purchasePrice: Decimal;
  totalAcquisitionCost: Decimal;
  annualGrossRent: Decimal;
  effectiveRent: Decimal;
  operatingExpenses: Decimal;
  noi: Decimal; // Net Operating Income
  grossYield: Decimal; // (annualGrossRent / purchasePrice) * 100
  netYieldOnCost: Decimal; // (noi / totalAcquisitionCost) * 100
}

/**
 * Calculates rental metrics according to Section 15 of the specification:
 * - effective_rent = annual_gross_rent * (1 - vacancy_rate)
 * - operating_expenses = service_charges + management + maintenance
 * - NOI = effective_rent - operating_expenses
 * - gross_yield = annual_gross_rent / purchase_price
 * - net_yield_on_cost = NOI / total_acquisition_and_fitout_cost
 */
export function calculateRentalScenario(input: RentalScenarioInput): RentalScenarioResult {
  const purchasePrice = toDecimal(input.purchasePrice);
  const totalCost = input.totalAcquisitionCost ? toDecimal(input.totalAcquisitionCost) : purchasePrice;
  const grossRent = toDecimal(input.annualGrossRent);
  const vacancyRate = toDecimal(input.vacancyRate || 0.05);
  const serviceCharges = toDecimal(input.serviceChargesAnnual);
  const mgmtRate = toDecimal(input.managementFeeRate || 0);
  const maintenance = toDecimal(input.maintenanceAnnual);

  const effectiveRent = grossRent.times(new Decimal(1).minus(vacancyRate));
  const managementFee = effectiveRent.times(mgmtRate);
  const operatingExpenses = serviceCharges.plus(managementFee).plus(maintenance);
  const noi = effectiveRent.minus(operatingExpenses);

  const grossYield = purchasePrice.isZero()
    ? new Decimal(0)
    : grossRent.dividedBy(purchasePrice).times(100);

  const netYieldOnCost = totalCost.isZero()
    ? new Decimal(0)
    : noi.dividedBy(totalCost).times(100);

  return {
    purchasePrice,
    totalAcquisitionCost: totalCost,
    annualGrossRent: grossRent,
    effectiveRent,
    operatingExpenses,
    noi,
    grossYield,
    netYieldOnCost,
  };
}
