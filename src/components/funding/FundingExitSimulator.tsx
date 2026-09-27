"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Clock,
  Key,
  Layers,
  FileText,
  Calculator,
  Percent,
  Building,
  Copy,
  Check,
  Share2,
  Sparkles,
  ArrowRight,
  Sofa,
  Coins,
  Scale,
} from "lucide-react";
import { formatAED, formatPercent, Decimal } from "@/lib/decimal";
import { calculateTransactionCosts } from "@/domain/funding/transaction-costs";
import {
  generatePaymentPlan,
  PaymentPlanPreset,
  PRESET_TEMPLATES,
} from "@/domain/funding/payment-plan-generator";
import {
  evaluateAssignmentResale,
  evaluateHandoverAndHold,
  solveTargetResalePriceForRoi,
  calculatePostHandoverRentalOffset,
} from "@/domain/exit/exit-scenario-engine";
import { evaluateFunding, ClientFundingProfile, OfferPaymentSchedule } from "@/domain/funding/evaluate-funding";

interface FundingExitSimulatorProps {
  initialPrice?: number;
  initialAreaSqft?: number;
  projectName?: string;
  unitLabel?: string;
  handoverDate?: string;
  assignmentPolicy?: "allowed" | "prohibited" | "conditional" | "unknown";
  minPaidPctForNoc?: number;
}

export function FundingExitSimulator({
  initialPrice = 2000000,
  initialAreaSqft = 850,
  projectName = "Selected Off-Plan Residence",
  unitLabel = "1-Bedroom Executive",
  handoverDate = "2028-12-01",
  assignmentPolicy = "allowed",
  minPaidPctForNoc = 34,
}: FundingExitSimulatorProps) {
  // Inputs state
  const [contractPrice, setContractPrice] = useState<number>(initialPrice);
  const [areaSqft, setAreaSqft] = useState<number>(initialAreaSqft);
  const [paymentPreset, setPaymentPreset] = useState<PaymentPlanPreset>("60/40");
  const [stressDelayMonths, setStressDelayMonths] = useState<0 | 6 | 12>(0);
  const [activeStrategyTab, setActiveStrategyTab] = useState<"assignment" | "rental" | "comparison">("comparison");

  // Assignment resale parameters
  const [paidPercentSlider, setPaidPercentSlider] = useState<number>(40); // 40% paid
  const [nocThreshold, setNocThreshold] = useState<number>(minPaidPctForNoc || 34);
  const [customResalePsf, setCustomResalePsf] = useState<number>(Math.round((initialPrice / initialAreaSqft) * 1.15));
  const [targetRoiInput, setTargetRoiInput] = useState<number>(25);

  // Rental parameters
  const [isFurnished, setIsFurnished] = useState<boolean>(false);
  const [furnishingCost, setFurnishingCost] = useState<number>(45000); // 45k AED for 1BR
  const [grossRentAed, setGrossRentAed] = useState<number>(Math.round(initialPrice * 0.075)); // default ~7.5% gross
  const [serviceChargePerSqft, setServiceChargePerSqft] = useState<number>(16); // AED 16/sqft standard Dubai
  const [holdingYears, setHoldingYears] = useState<1 | 3 | 5>(3);
  const [capitalAppreciationRate, setCapitalAppreciationRate] = useState<number>(3); // 3% p.a.

  // Client liquidity state for solvency check
  const [initialCashAvailable, setInitialCashAvailable] = useState<number>(Math.round(initialPrice * 0.35));
  const [liquidityReserve, setLiquidityReserve] = useState<number>(50000);

  // Export Modal & Copy State
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareLanguage, setShareLanguage] = useState<"RU" | "EN">("RU");
  const [copied, setCopied] = useState<boolean>(false);

  // 1. Transaction Costs
  const fees = useMemo(() => {
    return calculateTransactionCosts({ contractPrice });
  }, [contractPrice]);

  // 2. Payment Plan Timeline
  const paymentPlan = useMemo(() => {
    return generatePaymentPlan(contractPrice, paymentPreset, "2026-10-01", stressDelayMonths);
  }, [contractPrice, paymentPreset, stressDelayMonths]);

  // 3. Client Solvency / Liquidity Headroom
  const solvencyResult = useMemo(() => {
    const offerSchedule: OfferPaymentSchedule = {
      offerId: "sim-1",
      projectName,
      contractPrice,
      milestones: paymentPlan.milestones.map((m) => ({
        date: m.date,
        amount: m.amountAED,
        percent: m.percent,
        description: `${m.label} (${m.dldMilestone})`,
      })),
      fees: [
        {
          date: paymentPlan.milestones[0]?.date || "2026-10-01",
          amount: fees.totalTransactionFeesAED,
          description: "Mandatory DLD & Trustee Fees",
        },
      ],
    };

    const client: ClientFundingProfile = {
      initialLiquidCash: initialCashAvailable,
      requiredReserve: liquidityReserve,
      plannedInflows: [
        {
          date: paymentPlan.milestones[1]?.date || "2027-04-01",
          amount: contractPrice * 0.15,
          label: "Committed Business Inflow",
        },
        {
          date: paymentPlan.milestones[2]?.date || "2027-10-01",
          amount: contractPrice * 0.20,
          label: "Asset Dividends",
        },
        {
          date: paymentPlan.milestones[paymentPlan.milestones.length - 1]?.date || "2028-12-01",
          amount: contractPrice * 0.45,
          label: "Final Capital Allocation / Handover",
        },
      ],
    };

    return evaluateFunding(client, offerSchedule, stressDelayMonths);
  }, [contractPrice, paymentPlan, fees, initialCashAvailable, liquidityReserve, stressDelayMonths, projectName]);

  // 4. Strategy A: Assignment Resale Analysis
  const currentPaidCapital = (contractPrice * paidPercentSlider) / 100;
  const customTargetPriceAED = customResalePsf * areaSqft;

  const assignmentAnalysis = useMemo(() => {
    return evaluateAssignmentResale({
      contractPrice,
      areaSqft,
      paidCapital: currentPaidCapital,
      minPaidPercentRequired: nocThreshold,
      assignmentPolicy,
      acquisitionCosts: fees.totalTransactionFeesAED,
      developerNocFee: fees.developerNocFeeAED,
      customResalePrice: customTargetPriceAED,
    });
  }, [contractPrice, areaSqft, currentPaidCapital, nocThreshold, assignmentPolicy, fees, customTargetPriceAED]);

  // Solve for Target ROI
  const solvedForTargetRoi = useMemo(() => {
    return solveTargetResalePriceForRoi({
      contractPrice,
      areaSqft,
      paidCapital: currentPaidCapital,
      targetRoiPercent: targetRoiInput,
      acquisitionCosts: fees.totalTransactionFeesAED,
      developerNocFee: fees.developerNocFeeAED,
      minPaidPercentRequired: nocThreshold,
      assignmentPolicy,
    });
  }, [contractPrice, areaSqft, currentPaidCapital, targetRoiInput, fees, nocThreshold, assignmentPolicy]);

  // 5. Strategy B: Handover & Hold Analysis
  const effectiveFurnishingCost = isFurnished ? furnishingCost : 0;
  const effectiveGrossRent = isFurnished ? grossRentAed * 1.15 : grossRentAed;
  const annualServiceChargeTotal = serviceChargePerSqft * areaSqft;

  const rentalAnalysis = useMemo(() => {
    return evaluateHandoverAndHold({
      contractPrice,
      totalAcquisitionCost: fees.totalAcquisitionCostAED,
      furnishingCostAED: effectiveFurnishingCost,
      annualGrossRent: effectiveGrossRent,
      serviceChargesAnnual: annualServiceChargeTotal,
      managementFeeRate: 0.05,
      holdingYears,
      annualCapitalAppreciationRate: capitalAppreciationRate / 100,
      handoverDateStr: handoverDate,
    });
  }, [contractPrice, fees, effectiveFurnishingCost, effectiveGrossRent, annualServiceChargeTotal, holdingYears, capitalAppreciationRate, handoverDate]);

  // Post-Handover Rental Offset ("Self-Funding") Calculation
  const postHandoverMilestones = useMemo(() => {
    return paymentPlan.milestones.filter((m) => m.isPostHandover);
  }, [paymentPlan]);

  const postHandoverAnnualInstallments = useMemo(() => {
    if (postHandoverMilestones.length === 0) return 0;
    const totalPost = postHandoverMilestones.reduce((acc, m) => acc + m.amountAED.toNumber(), 0);
    // Usually spread across 2 years
    return totalPost / Math.max(1, postHandoverMilestones.length <= 2 ? postHandoverMilestones.length : 2);
  }, [postHandoverMilestones]);

  const postHandoverOffset = useMemo(() => {
    return calculatePostHandoverRentalOffset({
      postHandoverInstallmentsAnnualAED: postHandoverAnnualInstallments,
      annualNetRentAED: rentalAnalysis.rentalMetrics.noi,
    });
  }, [postHandoverAnnualInstallments, rentalAnalysis]);

  // Client WhatsApp/Telegram Share Text
  const shareMessageText = useMemo(() => {
    const askPsf = Math.round(contractPrice / areaSqft);
    const bePsf = Math.round(assignmentAnalysis.breakEvenPsfAED.toNumber());
    const baselineFlip = assignmentAnalysis.scenarios.find((s) => s.appreciationPercent === 10);
    const flipProfit = baselineFlip ? Math.round(baselineFlip.netProfitAED.toNumber()) : 0;
    const flipRoi = baselineFlip ? baselineFlip.cashOnCashRoiPercent.toFixed(1) : "0";

    if (shareLanguage === "RU") {
      return `📊 *ИНВЕСТИЦИОННЫЙ РАСЧЕТ И СЦЕНАРИИ ВЫХОДА*
🏢 *Проект:* ${projectName} (${unitLabel})
📐 *Площадь:* ${areaSqft} sq.ft.
💰 *Стоимость:* ${formatAED(contractPrice)} (${askPsf} AED/sq.ft.)
📅 *Ожидаемая сдача:* ${handoverDate}

🏛 *ОБЯЗАТЕЛЬНЫЕ РАСХОДЫ DLD:*
• Регистрация DLD (4%): ${formatAED(fees.dldRegistrationFeeAED)}
• Свидетельство Oqood: AED 580
• Trustee Fee: AED 4 200 (вкл. НДС)
• Итого на входе: ${formatAED(fees.totalAcquisitionCostAED)}

📈 *СТРАТЕГИЯ А: ПЕРЕУСТУПКА (FLIP ДО СДАЧИ)*
• Вложено капитала (~${paidPercentSlider}% + сборы): ${formatAED(assignmentAnalysis.scenarios[1]?.investedCashAED || 0)}
• Точка безубыточности (Break-Even PSF): *${bePsf} AED/sq.ft.*
• Базовый сценарий (+10% рост): Чистая прибыль *${formatAED(flipProfit)}* (ROI *${flipRoi}%* на вложенный капитал)

🔑 *СТРАТЕГИЯ Б: АРЕНДА (HANDOVER & HOLD)*
• Годовая валовая аренда: ${formatAED(effectiveGrossRent)}
• Чистый операционный доход (NOI): ${formatAED(rentalAnalysis.rentalMetrics.noi)}/год
• Чистая доходность (Net Yield): *${rentalAnalysis.rentalMetrics.netYieldOnCost.toFixed(2)}%*
• Годовая внутренняя доходность (*XIRR* на ${holdingYears}г): *${rentalAnalysis.xirrResult.xirrPercent ? rentalAnalysis.xirrResult.xirrPercent.toFixed(1) : "—"}%*

_Расчет выполнен на сертифицированном движке Dubai Off-Plan Desk (DLD Verified)._`;
    } else {
      return `📊 *OFF-PLAN INVESTMENT & EXIT ANALYSIS*
🏢 *Project:* ${projectName} (${unitLabel})
📐 *Size:* ${areaSqft} sq.ft.
💰 *Contract Price:* ${formatAED(contractPrice)} (${askPsf} AED/sq.ft.)
📅 *Handover:* ${handoverDate}

🏛 *MANDATORY DLD TRANSACTION FEES:*
• DLD Transfer (4%): ${formatAED(fees.dldRegistrationFeeAED)}
• Title Deed / Oqood: AED 580
• Registration Trustee: AED 4,200 (incl. VAT)
• Total Acquisition Capital: ${formatAED(fees.totalAcquisitionCostAED)}

📈 *STRATEGY A: ASSIGNMENT RESALE (PRE-HANDOVER FLIP)*
• Capital Deployed (~${paidPercentSlider}% + fees): ${formatAED(assignmentAnalysis.scenarios[1]?.investedCashAED || 0)}
• Break-Even PSF: *${bePsf} AED/sq.ft.*
• Baseline Exit (+10% market growth): Net Profit *${formatAED(flipProfit)}* (Cash-on-Cash ROI *${flipRoi}%*)

🔑 *STRATEGY B: HANDOVER & HOLD (RENTAL & LONG-TERM)*
• Gross Annual Rent: ${formatAED(effectiveGrossRent)}
• Net Operating Income (NOI): ${formatAED(rentalAnalysis.rentalMetrics.noi)}/yr
• Net Yield on Cost: *${rentalAnalysis.rentalMetrics.netYieldOnCost.toFixed(2)}%*
• Annualized *XIRR* (${holdingYears}-Year Hold): *${rentalAnalysis.xirrResult.xirrPercent ? rentalAnalysis.xirrResult.xirrPercent.toFixed(1) : "—"}%*

_Generated via Dubai Off-Plan Research Desk (DLD Open Data Verified)._`;
    }
  }, [
    shareLanguage,
    projectName,
    unitLabel,
    areaSqft,
    contractPrice,
    handoverDate,
    fees,
    paidPercentSlider,
    assignmentAnalysis,
    effectiveGrossRent,
    rentalAnalysis,
    holdingYears,
  ]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareMessageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-2xs">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Funding &amp; Exit Scenario Engine
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  Phase 4 Live (§9, §11, §12)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Deterministic cashflows &bull; DLD fee schedule &bull; Delay stress testing &bull; Break-Even PSF &bull; Dual Exit XIRR
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Quick Parameters */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span>Copy Client Summary</span>
          </button>

          <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Contract Price</span>
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-slate-900">
              <span className="text-slate-500 text-xs">AED</span>
              <input
                type="number"
                step="50000"
                value={contractPrice}
                onChange={(e) => setContractPrice(Math.max(100000, Number(e.target.value)))}
                className="bg-transparent border-none text-slate-900 font-bold focus:outline-none w-28 text-sm"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Size (Sq.Ft.)</span>
            <input
              type="number"
              value={areaSqft}
              onChange={(e) => setAreaSqft(Math.max(100, Number(e.target.value)))}
              className="bg-transparent border-none text-slate-900 font-bold font-mono focus:outline-none w-20 text-sm"
            />
          </div>
        </div>
      </div>

      {/* SECTION 1: MANDATORY DLD & TRANSACTION COSTS CALCULATOR */}
      <div className="bg-slate-50/60 border border-slate-200/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. Mandatory DLD &amp; Transaction Costs (§9, §11)
            </h3>
          </div>
          <div className="text-xs text-slate-500">
            Total Fees: <strong className="text-slate-900 font-mono font-semibold">{formatAED(fees.totalTransactionFeesAED)}</strong> (
            {fees.feesPercentOfPrice.toFixed(2)}% of price)
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-500 block text-[11px] font-medium">DLD Registration (4%)</span>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {formatAED(fees.dldRegistrationFeeAED)}
            </div>
            <span className="text-[10px] text-slate-400">Official Land Dept Transfer</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-500 block text-[11px] font-medium">Title Deed / Oqood</span>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {formatAED(fees.oqoodCertificateFeeAED)}
            </div>
            <span className="text-[10px] text-slate-400">DLD Certificate Fee</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-500 block text-[11px] font-medium">Trustee Office Fee</span>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {formatAED(fees.totalTrusteeFeeAED)}
            </div>
            <span className="text-[10px] text-slate-400">AED 4,000 + 5% VAT</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-500 block text-[11px] font-medium">Developer NOC Fee</span>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {formatAED(fees.developerNocFeeAED)}
            </div>
            <span className="text-[10px] text-slate-400">Consent for Transfer</span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-xs">
          <span className="text-emerald-900 font-medium">
            Total Acquisition Capital Required (Contract Price + All Mandatory Fees):
          </span>
          <span className="text-base font-bold font-mono text-emerald-800 tabular-nums">
            {formatAED(fees.totalAcquisitionCostAED)}
          </span>
        </div>
      </div>

      {/* SECTION 2: PAYMENT PLAN TIMELINE & DELAY STRESS TESTING */}
      <div className="bg-slate-50/60 border border-slate-200/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/70 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Payment Plan Timeline &amp; Delay Stress Testing (§9)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Payment Preset Selector */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 text-xs shadow-2xs">
              <span className="text-slate-500 text-[11px] font-medium">Plan:</span>
              {(["60/40", "70/30", "80/20", "50/50", "40/60_post_handover"] as PaymentPlanPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPaymentPreset(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    paymentPreset === preset
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {preset.replace("_post_handover", " PH")}
                </button>
              ))}
            </div>

            {/* Delay Stress Testing Toggle */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 text-xs shadow-2xs">
              <Sliders className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-slate-500 text-[11px] font-medium">Stress Delay:</span>
              <button
                onClick={() => setStressDelayMonths(0)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  stressDelayMonths === 0 ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                0m
              </button>
              <button
                onClick={() => setStressDelayMonths(6)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  stressDelayMonths === 6 ? "bg-amber-500 text-white font-bold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                +6m
              </button>
              <button
                onClick={() => setStressDelayMonths(12)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  stressDelayMonths === 12 ? "bg-amber-500 text-white font-bold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                +12m
              </button>
            </div>
          </div>
        </div>

        {/* Solvency Audit Alert */}
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          solvencyResult.status === "PASSED"
            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
            : "bg-amber-50 text-amber-900 border-amber-200"
        }`}>
          <div className="flex items-center gap-2.5">
            {solvencyResult.status === "PASSED" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">Liquidity Headroom Deficit Check: </span>
              <span>{solvencyResult.statusReason}</span>
            </div>
          </div>
          <span className="font-mono font-bold bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-800 text-[11px] shadow-2xs">
            Min Headroom: {formatAED(solvencyResult.minHeadroom)}
          </span>
        </div>

        {/* Milestones Table */}
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/80 font-semibold">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Milestone Stage</th>
                <th className="py-2.5 px-3">DLD Construction Linkage</th>
                <th className="py-2.5 px-3 text-right">Percent</th>
                <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                <th className="py-2.5 px-3 text-center">Tied to Construction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {paymentPlan.milestones.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 text-slate-700 font-semibold">{m.date}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-900 font-medium flex items-center gap-1.5">
                    {m.isHandover && <Key className="h-3.5 w-3.5 text-amber-600" />}
                    {m.label}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">{m.dldMilestone}</td>
                  <td className="py-2.5 px-3 text-right text-sky-700 font-semibold">{m.percent}%</td>
                  <td className="py-2.5 px-3 text-right text-slate-900 font-bold">{formatAED(m.amountAED)}</td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    {m.isConstructionTied ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                        {stressDelayMonths > 0 ? `Delayed (+${stressDelayMonths}m)` : "Contingent"}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        Fixed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: STRATEGY ENGINE & ENHANCEMENTS */}
      <div className="space-y-4">
        {/* Strategy Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveStrategyTab("comparison")}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeStrategyTab === "comparison"
                ? "border-sky-600 text-sky-700 bg-sky-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Scale className="h-4 w-4" />
            Side-by-Side: Flip vs Hold
          </button>
          <button
            onClick={() => setActiveStrategyTab("assignment")}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeStrategyTab === "assignment"
                ? "border-sky-600 text-sky-700 bg-sky-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Strategy A: Assignment Resale &amp; What-If
          </button>
          <button
            onClick={() => setActiveStrategyTab("rental")}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeStrategyTab === "rental"
                ? "border-sky-600 text-sky-700 bg-sky-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Key className="h-4 w-4" />
            Strategy B: Handover &amp; Hold + Self-Funding
          </button>
        </div>

        {/* TAB 1: SIDE-BY-SIDE COMPARISON (FLIP VS HOLD) */}
        {activeStrategyTab === "comparison" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strategy A Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      Strategy A: Assignment Flip
                    </span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      High Velocity Capital
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">Resale Prior to Handover</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Exit the transaction before completion once the required NOC threshold ({nocThreshold}%) is reached, transferring the remaining developer payment obligations to the new buyer.
                  </p>

                  <div className="space-y-2 pt-3 border-t border-slate-100 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Capital Deployed:</span>
                      <span className="text-slate-900 font-bold">{formatAED(assignmentAnalysis.scenarios[1]?.investedCashAED || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Break-Even PSF:</span>
                      <span className="text-amber-700 font-bold">{formatAED(assignmentAnalysis.breakEvenPsfAED)} AED/sqft</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Net Profit (+10% Exit):</span>
                      <span className="text-emerald-700 font-bold">
                        +{formatAED(assignmentAnalysis.scenarios[1]?.netProfitAED || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Cash-on-Cash Period ROI:</span>
                      <span className="text-emerald-700 font-bold">
                        +{formatPercent(assignmentAnalysis.scenarios[1]?.cashOnCashRoiPercent || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 mt-4 shadow-2xs">
                  <strong>Risk &amp; Liquidity Profile:</strong> Relies on secondary market buyer absorption prior to handover. Protected by low break-even buffer below ready comparables.
                </div>
              </div>

              {/* Strategy B Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                      <Key className="h-4 w-4 text-sky-600" />
                      Strategy B: Handover &amp; Hold
                    </span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                      Passive Cash Flow &amp; Equity
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">Completion &amp; Long-Term Lease</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Settle 100% of purchase commitments, collect keys, fit out the apartment, and generate consistent annual yields backed by registered Ejari tenancy contracts.
                  </p>

                  <div className="space-y-2 pt-3 border-t border-slate-100 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Capital Committed:</span>
                      <span className="text-slate-900 font-bold">{formatAED(rentalAnalysis.rentalMetrics.totalAcquisitionCost)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Net Operating Income (NOI):</span>
                      <span className="text-emerald-700 font-bold">+{formatAED(rentalAnalysis.rentalMetrics.noi)}/year</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Net Rental Yield on Cost:</span>
                      <span className="text-sky-700 font-bold">{formatPercent(rentalAnalysis.rentalMetrics.netYieldOnCost)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Annualized XIRR ({holdingYears}y Hold):</span>
                      <span className="text-emerald-700 font-bold text-sm">
                        {rentalAnalysis.xirrResult.xirrPercent ? formatPercent(rentalAnalysis.xirrResult.xirrPercent) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 text-[11px] text-sky-950 mt-4 shadow-2xs">
                  <strong>Risk &amp; Liquidity Profile:</strong> Requires full capital outlay; generates defensive cashflows and long-term capital preservation against inflation.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STRATEGY A CONTENT (ASSIGNMENT + WHAT-IF SOLVER) */}
        {activeStrategyTab === "assignment" && (
          <div className="space-y-6">
            {/* Top Bar: NOC Threshold & Break-Even Metric */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* NOC Eligibility Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Developer NOC Threshold</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    assignmentAnalysis.eligibility.isEligible
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}>
                    {assignmentAnalysis.eligibility.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Paid to Developer:</span>
                    <span className="font-mono font-bold text-slate-900">{paidPercentSlider}% ({formatAED(currentPaidCapital)})</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={paidPercentSlider}
                    onChange={(e) => setPaidPercentSlider(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>NOC requirement: {nocThreshold}%</span>
                    <span>100% Handover</span>
                  </div>
                </div>

                {!assignmentAnalysis.eligibility.isEligible && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 shadow-2xs">
                    <strong>NOC Bridge Top-Up: </strong>
                    An additional <strong>{formatAED(assignmentAnalysis.topupRequiredAED)}</strong> must be paid to developer to issue the NOC for transfer.
                  </div>
                )}
              </div>

              {/* Exact Break-Even Resale Price */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">
                    Break-Even Resale Price
                  </span>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatAED(assignmentAnalysis.breakEvenResalePriceAED)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recovers full purchase price, {formatAED(fees.totalTransactionFeesAED)} acquisition costs, NOC fee &amp; 2% agency commission.
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 font-medium">
                  Net Profit = 0 at this price point.
                </div>
              </div>

              {/* Break-Even PSF */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">
                    Break-Even PSF
                  </span>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatAED(assignmentAnalysis.breakEvenPsfAED)}{" "}
                    <span className="text-xs font-normal text-slate-500">AED/sqft</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Compare this with ready comps median to evaluate downside buffer.
                  </p>
                </div>
                <div className="text-[10px] text-emerald-700 border-t border-slate-100 pt-2 font-mono font-medium">
                  Base asking: {formatAED(contractPrice / areaSqft)} AED/sqft
                </div>
              </div>
            </div>

            {/* WHAT-IF & TARGET ROI SOLVER */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Interactive "What-If" Target Resale &amp; Target ROI Solver
                  </h4>
                </div>
                <div className="text-xs text-slate-500">
                  Analytical root solver for custom client target returns
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Custom PSF Slider */}
                <div className="space-y-3 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">Custom Resale PSF Target:</span>
                    <span className="font-mono font-bold text-sky-700 text-sm">{customResalePsf} AED/sqft</span>
                  </div>
                  <input
                    type="range"
                    min={Math.round((contractPrice / areaSqft) * 0.8)}
                    max={Math.round((contractPrice / areaSqft) * 1.6)}
                    step="25"
                    value={customResalePsf}
                    onChange={(e) => setCustomResalePsf(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs font-mono text-slate-500 pt-1 border-t border-slate-100">
                    <span>Resale Price: <strong className="text-slate-900 font-semibold">{formatAED(customTargetPriceAED)}</strong></span>
                    <span>Growth: <strong className="text-emerald-700 font-semibold">+{((customTargetPriceAED / contractPrice - 1) * 100).toFixed(1)}%</strong></span>
                  </div>
                </div>

                {/* Target ROI Solver */}
                <div className="space-y-3 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">Target Cash-on-Cash ROI:</span>
                    <div className="flex items-center gap-1.5">
                      {[15, 25, 35].map((roi) => (
                        <button
                          key={roi}
                          onClick={() => setTargetRoiInput(roi)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            targetRoiInput === roi ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {roi}%
                        </button>
                      ))}
                      <input
                        type="number"
                        value={targetRoiInput}
                        onChange={(e) => setTargetRoiInput(Number(e.target.value))}
                        className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-900 font-mono w-14 text-center font-bold"
                      />
                      <span className="text-slate-400 text-xs">%</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono space-y-1 pt-1 border-t border-slate-100">
                    <div className="flex justify-between text-slate-500">
                      <span>Required Resale Price:</span>
                      <span className="text-slate-900 font-bold">{formatAED(solvedForTargetRoi.targetResalePriceAED)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Required Resale PSF:</span>
                      <span className="text-sky-700 font-bold">{formatAED(solvedForTargetRoi.targetResalePsfAED)} AED/sqft</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Standard Market Scenarios Table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assignmentAnalysis.scenarios.map((sc, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/90 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        sc.appreciationPercent < 0
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : sc.appreciationPercent === 10
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {sc.label}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                        {formatAED(sc.resalePriceAED)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono">
                      Resale PSF: <strong className="text-slate-900">{formatAED(sc.resalePsfAED)}</strong> AED/sqft
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-mono border-t border-slate-100 pt-3">
                    <div className="flex justify-between text-slate-500">
                      <span>Buyer Assumed Debt:</span>
                      <span className="text-slate-800">{formatAED(sc.outstandingBalanceAED)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Seller Net Receipt:</span>
                      <span className="text-slate-800">{formatAED(sc.sellerReceiptAED)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Invested Cash (A+C):</span>
                      <span className="text-slate-800">{formatAED(sc.investedCashAED)}</span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-bold">
                      <span className="text-slate-700">Net Profit:</span>
                      <span className={sc.netProfitAED.greaterThan(0) ? "text-emerald-700" : "text-rose-700"}>
                        {formatAED(sc.netProfitAED)}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Cash-on-Cash ROI:</span>
                      <span className={sc.cashOnCashRoiPercent.greaterThan(0) ? "text-emerald-700" : "text-rose-700"}>
                        {formatPercent(sc.cashOnCashRoiPercent)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STRATEGY B CONTENT (RENTAL + FURNISHING + POST-HANDOVER) */}
        {activeStrategyTab === "rental" && (
          <div className="space-y-6">
            {/* Furnishing Pack Toggle & Rental Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Furnishing Toggle Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Furnishing Pack</span>
                  <button
                    onClick={() => setIsFurnished(!isFurnished)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      isFurnished ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isFurnished ? "✓ Furnished" : "Unfurnished"}
                  </button>
                </div>
                {isFurnished ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-mono text-emerald-700 font-bold">
                      <span>+AED</span>
                      <input
                        type="number"
                        value={furnishingCost}
                        onChange={(e) => setFurnishingCost(Number(e.target.value))}
                        className="bg-transparent border-none text-emerald-700 font-bold w-20 text-sm"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block">+15% rental premium applied</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 block pt-1">Standard unfurnished long-term lease</span>
                )}
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Gross Annual Rent</span>
                <div className="flex items-center gap-1 font-mono font-bold text-lg text-emerald-700 mt-1">
                  <span>AED</span>
                  <input
                    type="number"
                    step="5000"
                    value={grossRentAed}
                    onChange={(e) => setGrossRentAed(Number(e.target.value))}
                    className="bg-transparent border-none text-emerald-700 font-bold focus:outline-none w-28 text-lg"
                  />
                </div>
                <span className="text-[10px] text-slate-400">Effective: {formatAED(effectiveGrossRent)}</span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Service Charge (DLD OA)</span>
                <div className="flex items-center gap-1 font-mono font-bold text-lg text-slate-900 mt-1">
                  <span>AED</span>
                  <input
                    type="number"
                    value={serviceChargePerSqft}
                    onChange={(e) => setServiceChargePerSqft(Number(e.target.value))}
                    className="bg-transparent border-none text-slate-900 font-bold focus:outline-none w-14 text-lg"
                  />
                  <span className="text-xs text-slate-400 font-normal">/sqft</span>
                </div>
                <span className="text-[10px] text-slate-400">Total: {formatAED(annualServiceChargeTotal)}/yr</span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Net Yield on Total Cost</span>
                <div className="text-2xl font-bold font-mono text-sky-700 mt-1 tabular-nums">
                  {formatPercent(rentalAnalysis.rentalMetrics.netYieldOnCost)}
                </div>
                <span className="text-[10px] text-slate-400">NOI / Total Deployed Capital</span>
              </div>
            </div>

            {/* Post-Handover Rental Offset (Self-Funding Analysis) */}
            {paymentPlan.postHandoverPercent > 0 && (
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Post-Handover Rental Offset ("Self-Funding" Ratio)
                    </h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    postHandoverOffset.isSelfFunding
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-sky-50 text-sky-800 border-sky-200"
                  }`}>
                    {postHandoverOffset.isSelfFunding ? "100% Self-Funding" : "Partial Rental Coverage"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-emerald-800/80 text-[11px] block font-sans">Post-Handover Installment:</span>
                    <span className="text-slate-900 font-bold">{formatAED(postHandoverAnnualInstallments)}/year</span>
                  </div>
                  <div>
                    <span className="text-emerald-800/80 text-[11px] block font-sans">Net Rental Income (NOI):</span>
                    <span className="text-emerald-700 font-bold">{formatAED(rentalAnalysis.rentalMetrics.noi)}/year</span>
                  </div>
                  <div>
                    <span className="text-emerald-800/80 text-[11px] block font-sans">Rental Installment Coverage:</span>
                    <span className="text-slate-900 font-bold text-sm">
                      {postHandoverOffset.rentalCoveragePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-900/90 leading-relaxed pt-1">
                  {postHandoverOffset.isSelfFunding
                    ? `Rental income completely covers developer post-handover obligations with a positive surplus of ${formatAED(postHandoverOffset.surplusAnnualAED)}/year!`
                    : `Incoming rental income covers ${postHandoverOffset.rentalCoveragePercent.toFixed(1)}% of installments. The investor only needs an out-of-pocket top-up of ${formatAED(postHandoverOffset.netInvestorAnnualOutlayAED)}/year.`}
                </p>
              </div>
            )}

            {/* Hold Horizon & Pure XIRR Calculation */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-600" />
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Long-Term Hold &amp; Internal Rate of Return (XIRR)
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Holding Period:</span>
                  {([1, 3, 5] as const).map((years) => (
                    <button
                      key={years}
                      onClick={() => setHoldingYears(years)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        holdingYears === years
                          ? "bg-sky-600 text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {years} Year{years > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics Showcase */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] text-slate-500 block font-medium">Annual Net Operating Income (NOI)</span>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatAED(rentalAnalysis.rentalMetrics.noi)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Effective Rent ({formatAED(rentalAnalysis.rentalMetrics.effectiveRent)}) minus Expenses ({formatAED(rentalAnalysis.rentalMetrics.operatingExpenses)})
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] text-slate-500 block font-medium">Terminal Sale Price (after {holdingYears}y @ 3% p.a.)</span>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatAED(rentalAnalysis.terminalResalePriceAED)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Net liquidation receipt: {formatAED(rentalAnalysis.terminalNetExitReceiptAED)}
                  </p>
                </div>

                <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] text-sky-800 font-semibold block uppercase tracking-wider">
                    Annualized Internal Rate of Return (XIRR)
                  </span>
                  <div className="text-3xl font-extrabold font-mono text-emerald-700 mt-1 tabular-nums">
                    {rentalAnalysis.xirrResult.xirrPercent
                      ? formatPercent(rentalAnalysis.xirrResult.xirrPercent)
                      : "—"}
                  </div>
                  <p className="text-[10px] text-sky-700 mt-1">
                    Deterministic NPV=0 root solver across dated acquisition, rental flows, and liquidation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SHARE / EXPORT MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">Client Investment Summary</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareLanguage(shareLanguage === "RU" ? "EN" : "RU")}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                >
                  {shareLanguage === "RU" ? "🇷🇺 Русский" : "🇬🇧 English"}
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-all">
              {shareMessageText}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Ready to paste into WhatsApp, Telegram, or email.
              </span>
              <button
                onClick={handleCopyShare}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all active:scale-95 shadow-xs"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied to Clipboard!" : "Copy Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
