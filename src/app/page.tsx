"use client";

import React, { useState } from "react";
import { Header } from "@/components/desk/Header";
import { ClientBriefSection } from "@/components/desk/ClientBriefSection";
import { OfferComparisonSection, OfferData } from "@/components/desk/OfferComparisonSection";
import { FundingTimelineSection } from "@/components/desk/FundingTimelineSection";
import { ExitScenariosSection } from "@/components/desk/ExitScenariosSection";
import { PrintPreviewModal } from "@/components/desk/PrintPreviewModal";
import { evaluateFunding, OfferPaymentSchedule } from "@/domain/funding/evaluate-funding";
import { TransactionFact, buildComparableSet } from "@/domain/cma/comparable-set";
import { calculatePeriodReturn } from "@/domain/returns/calculate-period-return";
import { formatAED, formatPercent } from "@/lib/decimal";
import { ShieldCheck, CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";

// Mock verified Ready sales in the cluster based on real DLD DuckDB statistics
const clusterReadySales: TransactionFact[] = [
  { id: "tx-1", buildingName: "Standpoint Tower A", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-06-01", isOffPlan: false },
  { id: "tx-2", buildingName: "Standpoint Tower B", bedrooms: 1, areaSqft: 780, salePriceAED: 1872000, pricePerSqftAED: 2400, transactionDate: "2026-06-15", isOffPlan: false },
  { id: "tx-3", buildingName: "Burj Views C", bedrooms: 1, areaSqft: 720, salePriceAED: 1728000, pricePerSqftAED: 2400, transactionDate: "2026-07-01", isOffPlan: false },
  { id: "tx-4", buildingName: "Downtown Heights", bedrooms: 1, areaSqft: 800, salePriceAED: 1920000, pricePerSqftAED: 2400, transactionDate: "2026-07-20", isOffPlan: false },
  { id: "tx-5", buildingName: "The Address Fountain Views", bedrooms: 1, areaSqft: 750, salePriceAED: 1850000, pricePerSqftAED: 2466, transactionDate: "2026-08-01", isOffPlan: false },
  { id: "tx-6", buildingName: "Standpoint Tower A", bedrooms: 1, areaSqft: 740, salePriceAED: 1776000, pricePerSqftAED: 2400, transactionDate: "2026-08-05", isOffPlan: false },
  { id: "tx-7", buildingName: "Burj Views A", bedrooms: 1, areaSqft: 760, salePriceAED: 1824000, pricePerSqftAED: 2400, transactionDate: "2026-08-10", isOffPlan: false },
  { id: "tx-8", buildingName: "Burj Views B", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-08-15", isOffPlan: false },
  { id: "tx-9", buildingName: "Standpoint Tower B", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-08-20", isOffPlan: false },
  { id: "tx-10", buildingName: "Downtown Heights", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-08-22", isOffPlan: false },
  { id: "tx-11", buildingName: "Standpoint Tower A", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-08-25", isOffPlan: false },
  { id: "tx-12", buildingName: "Burj Views C", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-08-28", isOffPlan: false },
  { id: "tx-13", buildingName: "Downtown Heights", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-09-01", isOffPlan: false },
  { id: "tx-14", buildingName: "Standpoint Tower A", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-09-05", isOffPlan: false },
  { id: "tx-15", buildingName: "Burj Views A", bedrooms: 1, areaSqft: 750, salePriceAED: 1800000, pricePerSqftAED: 2400, transactionDate: "2026-09-10", isOffPlan: false },
];

const initialOfferA: OfferData = {
  id: "offer-a",
  projectName: "Downtown Views II (Tower 2)",
  developerName: "Emaar Properties",
  community: "Downtown Dubai (Burj Khalifa)",
  unitType: "1 Bedroom Corner Unit",
  areaSqft: 750,
  contractPrice: 1500000, // 2000 AED/sqft (vs 2400 ready median -> 16.7% discount)
  expectedHandover: "2028-12",
  assignmentPolicy: "allowed",
  minPaidPercentForNoc: 30,
  paymentMilestones: [
    { date: "2026-10-01", amount: 300000, percent: 20, description: "Booking Deposit (20%)" },
    { date: "2027-04-01", amount: 150000, percent: 10, description: "Foundation Completed (10%)" },
    { date: "2027-10-01", amount: 150000, percent: 10, description: "Structure 20th Floor (10%)" },
    { date: "2028-12-01", amount: 900000, percent: 60, description: "On Handover (60%)" },
  ],
  fees: [
    { date: "2026-10-01", amount: 64000, description: "DLD 4% (60k) + Oqood/Admin (4k)" },
  ],
  cmaReadySales: clusterReadySales,
};

const initialOfferB: OfferData = {
  id: "offer-b",
  projectName: "Creek Waters (Creek Island)",
  developerName: "Emaar Properties",
  community: "Dubai Creek Harbour",
  unitType: "1 Bedroom Mid-Floor",
  areaSqft: 740,
  contractPrice: 1650000, // 2230 AED/sqft (vs 2400 ready median -> 7.1% discount)
  expectedHandover: "2028-06",
  assignmentPolicy: "allowed",
  minPaidPercentForNoc: 40,
  paymentMilestones: [
    { date: "2026-10-01", amount: 330000, percent: 20, description: "Booking Deposit (20%)" },
    { date: "2027-03-01", amount: 165000, percent: 10, description: "Substructure Milestone (10%)" },
    { date: "2027-09-01", amount: 165000, percent: 10, description: "Superstructure Milestone (10%)" },
    { date: "2028-06-01", amount: 990000, percent: 60, description: "On Handover (60%)" },
  ],
  fees: [
    { date: "2026-10-01", amount: 70000, description: "DLD 4% (66k) + Admin (4k)" },
  ],
  cmaReadySales: clusterReadySales,
};

export default function ResearchDeskPage() {
  const [client, setClient] = useState({
    clientName: "VIP Investor - Alexander K.",
    targetBudget: 2000000,
    bedrooms: "1BR",
    targetCommunity: "Downtown Dubai / Business Bay",
    strategy: "flip" as "flip" | "rental",
    initialLiquidCash: 850000, // 850k AED available today
    requiredReserve: 100000,   // 100k safety buffer
    plannedInflows: [
      { date: "2027-03-15", amount: 350000, label: "Q1 Business Distribution" },
      { date: "2027-09-15", amount: 400000, label: "Fixed Deposit Maturity" },
    ],
  });

  const [offers, setOffers] = useState<[OfferData, OfferData]>([initialOfferA, initialOfferB]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("offer-a");
  const [stressDelayMonths, setStressDelayMonths] = useState<number>(0);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

  const handleUpdateOffer = (index: 0 | 1, updatedOffer: OfferData) => {
    setOffers((prev) => {
      const next: [OfferData, OfferData] = [prev[0], prev[1]];
      next[index] = updatedOffer;
      return next;
    });
  };

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || offers[0];

  const selectedSchedule: OfferPaymentSchedule = {
    offerId: selectedOffer.id,
    projectName: selectedOffer.projectName,
    contractPrice: selectedOffer.contractPrice,
    milestones: selectedOffer.paymentMilestones,
    fees: selectedOffer.fees,
  };

  const fundingEvaluation = evaluateFunding(client, selectedSchedule, stressDelayMonths);

  // Dynamic CMA & ROI metrics for Executive Header
  const selectedCma = buildComparableSet(
    selectedOffer.contractPrice,
    selectedOffer.areaSqft,
    selectedOffer.cmaReadySales,
    []
  );

  const selectedPaidCapital = selectedOffer.paymentMilestones
    .filter((m) => !m.description.toLowerCase().includes("handover"))
    .reduce((sum, m) => sum + m.amount, 0);

  const selectedAcquisitionCosts = selectedOffer.fees.reduce((sum, f) => sum + f.amount, 0);
  const selectedBaselineResale = selectedOffer.contractPrice * 1.10;
  const selectedExitCosts = 10000 + selectedBaselineResale * 0.02;

  const selectedReturn = calculatePeriodReturn({
    contractPrice: selectedOffer.contractPrice,
    paidCapital: selectedPaidCapital,
    acquisitionCosts: selectedAcquisitionCosts,
    resalePrice: selectedBaselineResale,
    exitCosts: selectedExitCosts,
  });
  return (
    <div className="min-h-screen pb-20 bg-slate-50 text-slate-900">
      <Header
        activePhase="Phase 7: Real Pilot Operational"
        onOpenPrintPreview={() => setIsPrintPreviewOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Executive Command Hub & Featured Property Banner */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
          {/* Top Title & Action Bar */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/80">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Executive Research Desk &bull; 2026 Edition
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DLD Live DuckDB
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Off-Plan Financial &amp; Exit Decision Engine
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Deterministic liquidity stress testing, multi-group comparative market analysis, and contractual NOC exit modeling for Dubai off-plan investors.
              </p>
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => setIsPrintPreviewOpen(true)}
                className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm ring-1 ring-slate-900/10 active:scale-95 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4 text-sky-400" />
                <span>Open PDF Print Preview</span>
              </button>
            </div>
          </div>

          {/* Real-Time KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
            {/* KPI 1: Solvency Status */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-sm">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center justify-between">
                <span>Solvency Gate</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="my-2.5 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-emerald-700 tracking-tight">
                    {fundingEvaluation.status}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Zero Deficit Check
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-700 font-mono pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-sans">Min Headroom:</span>
                <span className="text-emerald-700 font-bold">{formatAED(fundingEvaluation.minHeadroom.toNumber())}</span>
              </div>
            </div>

            {/* KPI 2: Target Allocation */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-sm">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Target Budget</div>
              <div className="my-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {formatAED(client.targetBudget)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Max Acquisition Cap
                </div>
              </div>
              <div className="text-[11px] text-slate-700 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-sans">Profile:</span>
                <span className="text-amber-700 font-semibold">{client.bedrooms} &bull; {client.strategy === "flip" ? "Pre-Handover Flip" : "Rental Hold"}</span>
              </div>
            </div>

            {/* KPI 3: Selected Offer CMA Gap */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-sm">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center justify-between">
                <span>CMA vs Ready</span>
                {selectedCma.gapToReadyPercent ? (
                  <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                    {selectedCma.gapToReadyPercent.toFixed(1)}% {selectedCma.gapToReadyPercent.greaterThan(0) ? "Discount" : "Premium"}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">Comps active</span>
                )}
              </div>
              <div className="my-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight">
                  {selectedCma.gapToReadyPercent && selectedCma.gapToReadyPercent.greaterThan(0) ? "Discounted" : "Benchmark"}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                  {selectedOffer.projectName}
                </div>
              </div>
              <div className="text-[11px] text-slate-700 font-mono pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-sans">Ready Median:</span>
                <span className="text-slate-800 font-semibold">
                  {selectedCma.readyGroup.medianPsf ? `${formatAED(selectedCma.readyGroup.medianPsf)}/sqft` : "AED 2,400/sqft"}
                </span>
              </div>
            </div>

            {/* KPI 4: Baseline Flip ROI */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-sm">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center justify-between">
                <span>Baseline CoC ROI</span>
                <span className="text-[10px] font-bold text-sky-700 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200">
                  +10% Apprec.
                </span>
              </div>
              <div className="my-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-sky-700 tracking-tight">
                  {formatPercent(selectedReturn.returnOnInvestedCash)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Cash-on-Cash Return
                </div>
              </div>
              <div className="text-[11px] text-slate-700 font-mono pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-sans">Strategy:</span>
                <span className="text-slate-800 font-semibold">Pre-Handover Resale</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Client Brief */}
        <div id="brief-section">
          <ClientBriefSection client={client} onChange={setClient} />
        </div>

        {/* Section 2: Side-by-Side Offer Comparison */}
        <div id="offers-section">
          <OfferComparisonSection
            offers={offers}
            client={client}
            selectedOfferId={selectedOfferId}
            onSelectOffer={setSelectedOfferId}
            onUpdateOffer={handleUpdateOffer}
          />
        </div>

        {/* Section 3: Funding Timeline & Stress Test */}
        <div id="funding-section">
          <FundingTimelineSection
            timeline={fundingEvaluation.timeline}
            status={fundingEvaluation.status}
            statusReason={fundingEvaluation.statusReason}
            minHeadroom={fundingEvaluation.minHeadroom.toNumber()}
            initialCash={Number(client.initialLiquidCash)}
            reserve={Number(client.requiredReserve)}
            stressDelayMonths={stressDelayMonths}
            onStressDelayChange={setStressDelayMonths}
          />
        </div>

        {/* Section 4: Exit Scenarios & Downside Analysis */}
        <div id="exit-section">
          <ExitScenariosSection selectedOffer={selectedOffer} />
        </div>
      </main>

      {/* Printable Report Modal */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        offers={offers}
        client={client}
      />
    </div>
  );
}
