"use client";

import React, { useState } from "react";
import { Building, ShieldCheck, AlertTriangle, ArrowRight, DollarSign, Calendar, TrendingUp, CheckCircle, XCircle, Check, Award, Layers, Compass, Sliders } from "lucide-react";
import { formatAED, formatPercent, formatSqft } from "@/lib/decimal";
import { calculatePeriodReturn, calculateBreakEven } from "@/domain/returns/calculate-period-return";
import { evaluateFunding, OfferPaymentSchedule, ClientFundingProfile } from "@/domain/funding/evaluate-funding";
import { validateTransferEligibility, AssignmentPolicy } from "@/domain/exit/transfer-eligibility";
import { buildComparableSet, TransactionFact } from "@/domain/cma/comparable-set";
import { ProjectSelectModal } from "./ProjectSelectModal";

export interface OfferData {
  id: string;
  projectName: string;
  developerName: string;
  community: string;
  unitType: string;
  areaSqft: number;
  contractPrice: number;
  expectedHandover: string; // YYYY-MM
  assignmentPolicy: AssignmentPolicy;
  minPaidPercentForNoc: number;
  paymentMilestones: Array<{
    date: string;
    amount: number;
    percent: number;
    description: string;
  }>;
  fees: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
  cmaReadySales: TransactionFact[];
}

interface OfferComparisonSectionProps {
  offers: [OfferData, OfferData];
  client: ClientFundingProfile & { strategy: "flip" | "rental" };
  onSelectOffer?: (offerId: string) => void;
  selectedOfferId?: string;
  onUpdateOffer?: (index: 0 | 1, offer: OfferData) => void;
}

export function OfferComparisonSection({
  offers,
  client,
  onSelectOffer,
  selectedOfferId,
  onUpdateOffer,
}: OfferComparisonSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOptionIndex, setModalOptionIndex] = useState<0 | 1>(0);
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                Step 2 &bull; Comparative Analysis
              </span>
              <span className="text-xs font-mono text-slate-500">DLD 3-Group Benchmark</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Side-by-Side Offer Verification &amp; Solvency Gate
            </h2>
          </div>
        </div>
        <p className="text-xs text-slate-500 hidden sm:block font-medium">
          Select an offer to dynamically evaluate its exit economics and payment plan
        </p>
      </div>

      {/* Comparative Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {offers.map((offer, idx) => {
          const offerSchedule: OfferPaymentSchedule = {
            offerId: offer.id,
            projectName: offer.projectName,
            contractPrice: offer.contractPrice,
            milestones: offer.paymentMilestones,
            fees: offer.fees,
          };

          // 1. Funding evaluation
          const fundingRes = evaluateFunding(client, offerSchedule);

          // 2. CMA comparison
          const cmaRes = buildComparableSet(offer.contractPrice, offer.areaSqft, offer.cmaReadySales, []);

          // 3. Paid capital up to exit (assume flip before handover after paying e.g. 40% milestone)
          const paidBeforeHandover = offer.paymentMilestones
            .filter((m) => !m.description.toLowerCase().includes("handover"))
            .reduce((sum, m) => sum + m.amount, 0);

          const paidPctBeforeHandover = (paidBeforeHandover / offer.contractPrice) * 100;

          // 4. Transfer eligibility
          const transferRes = validateTransferEligibility({
            assignmentPolicy: offer.assignmentPolicy,
            minPaidPercentRequired: offer.minPaidPercentForNoc,
            currentPaidAmount: paidBeforeHandover,
            contractPrice: offer.contractPrice,
          });

          // 5. Returns under baseline (+10% price growth at exit)
          const baselineResalePrice = offer.contractPrice * 1.10;
          const acquisitionCost = offer.fees.reduce((sum, f) => sum + f.amount, 0);
          const exitCosts = 10000 + (baselineResalePrice * 0.02); // 10k admin + 2% agent
          const returnRes = calculatePeriodReturn({
            contractPrice: offer.contractPrice,
            paidCapital: paidBeforeHandover,
            acquisitionCosts: acquisitionCost,
            resalePrice: baselineResalePrice,
            exitCosts: exitCosts,
          });

          const breakEvenPrice = calculateBreakEven({
            contractPrice: offer.contractPrice,
            acquisitionCosts: acquisitionCost,
            fixedExitCosts: 10000,
            variableExitRate: 0.02,
          });

          const isSelected = selectedOfferId === offer.id;

          return (
            <div
              key={offer.id}
              onClick={() => onSelectOffer?.(offer.id)}
              className={`rounded-2xl p-6 sm:p-7 transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? "bg-white border-2 border-sky-600 shadow-md ring-2 ring-sky-500/10"
                  : "bg-white border border-slate-200/90 hover:border-slate-300 shadow-sm"
              }`}
            >
              {/* Option Selection Ribbon */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? "bg-sky-600 border-sky-600 text-white font-bold"
                        : "border-slate-300 bg-slate-100 text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-900">
                    Option {idx === 0 ? "A" : "B"}
                  </span>
                  <span className="text-xs text-slate-500">&bull; {offer.community}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalOptionIndex(idx as 0 | 1);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all shadow-sm active:scale-95 group/btn"
                    title="Выбрать реальный проект из каталога DLD или отредактировать параметры"
                  >
                    <Compass className="h-3.5 w-3.5 text-sky-600 group-hover/btn:rotate-45 transition-transform" />
                    <span>Выбрать из каталога</span>
                  </button>

                  {isSelected ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      Active Model
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 group-hover:text-sky-600 transition-colors">
                      Click to Select &rarr;
                    </span>
                  )}
                </div>
              </div>

              {/* Architectural Card Header */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/90 relative overflow-hidden">
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 inline-block shadow-sm">
                        {offer.developerName}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalOptionIndex(idx as 0 | 1);
                          setIsModalOpen(true);
                        }}
                        className="text-[10px] text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1 transition-colors font-medium"
                        title="Отредактировать параметры"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>Изменить</span>
                      </button>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{offer.projectName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{offer.unitType}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                      {formatAED(offer.contractPrice)}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono font-bold mt-0.5">
                      {formatAED(offer.contractPrice / offer.areaSqft)}/sqft &bull; {formatSqft(offer.areaSqft)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badges Row */}
              <div className="grid grid-cols-2 gap-3 my-4">
                {/* Solvency Status */}
                {(() => {
                  const isFlipStrategy = client.strategy === "flip";
                  const isFlipPassed = fundingRes.flipStatus === "PASSED";
                  const isFullPassed = fundingRes.status === "PASSED";

                  let badgeBg = "bg-rose-50 text-rose-800 border-rose-200";
                  let badgeTitle = `Solvency: ${fundingRes.status}`;
                  let badgeSubtitle = fundingRes.deficitDate ? `Deficit on ${fundingRes.deficitDate}` : fundingRes.statusReason;
                  let icon = <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />;

                  if (isFullPassed) {
                    badgeBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
                    badgeTitle = "Solvency: 100% Passed";
                    badgeSubtitle = `Headroom: ${formatAED(fundingRes.minHeadroom)}`;
                    icon = <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />;
                  } else if (isFlipStrategy && isFlipPassed) {
                    badgeBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
                    badgeTitle = "Flip Plan: Solvent";
                    badgeSubtitle = `+${formatAED(fundingRes.flipMinHeadroom)} surplus (Stress: ${formatAED(fundingRes.minHeadroom)})`;
                    icon = <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />;
                  }

                  return (
                    <div className={`p-3 rounded-xl border flex items-center space-x-2.5 text-xs transition-all ${badgeBg}`}>
                      {icon}
                      <div className="truncate">
                        <div className="font-bold text-[11px] uppercase tracking-wider">{badgeTitle}</div>
                        <div className="text-[10px] opacity-90 truncate font-mono mt-0.5 font-semibold">
                          {badgeSubtitle}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Transfer / NOC Status */}
                <div
                  className={`p-3 rounded-xl border flex items-center space-x-2.5 text-xs transition-all ${
                    transferRes.isEligible
                      ? "bg-sky-50 text-sky-800 border-sky-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {transferRes.isEligible ? (
                    <ShieldCheck className="h-4 w-4 text-sky-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <div className="font-bold text-[11px] uppercase tracking-wider">
                      NOC Policy: {transferRes.status}
                    </div>
                    <div className="text-[10px] opacity-90 truncate font-mono mt-0.5 font-semibold">
                      {transferRes.isEligible
                        ? `${paidPctBeforeHandover.toFixed(0)}% paid (≥ ${offer.minPaidPercentForNoc}% req)`
                        : `Requires +${formatAED(transferRes.topupRequiredAED)}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* CMA Ready Gap & Pricing Benchmark */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 mb-3 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">DLD Registered Ready Median:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {cmaRes.readyGroup.medianPsf ? `${formatAED(cmaRes.readyGroup.medianPsf)}/sqft` : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Price Spread vs Ready Comps:</span>
                  <span
                    className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
                      cmaRes.gapToReadyPercent && cmaRes.gapToReadyPercent.greaterThan(0)
                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        : "text-amber-800 bg-amber-50 border border-amber-200"
                    }`}
                  >
                    {cmaRes.gapToReadyPercent ? `${cmaRes.gapToReadyPercent.toFixed(1)}% Discount` : "Insufficient Sample (<5)"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 italic pt-2 border-t border-slate-200/80 leading-relaxed">
                  {cmaRes.editorialConclusion}
                </p>
              </div>

              {/* Exit Math & Economics (Baseline +10% Assumption) */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 text-xs space-y-3">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Pre-Handover Exit (+10% Resale)</span>
                  <span className="text-slate-900 font-mono font-bold">
                    Break-Even: {formatAED(breakEvenPrice)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center pt-1 border-t border-slate-200/80">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Invested Cash</div>
                    <div className="font-mono font-bold text-slate-800 mt-1">{formatAED(returnRes.investedCash)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Net Profit</div>
                    <div
                      className={`font-mono font-bold mt-1 ${
                        returnRes.netProfit.greaterThan(0) ? "text-emerald-700" : "text-rose-600 font-black"
                      }`}
                    >
                      {formatAED(returnRes.netProfit)}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Period ROI</div>
                    <div
                      className={`font-mono font-bold mt-1 ${
                        returnRes.returnOnInvestedCash.greaterThan(0) ? "text-emerald-700" : "text-rose-600 font-black"
                      }`}
                    >
                      {formatPercent(returnRes.returnOnInvestedCash)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Schedule Breakdown */}
              <div className="mt-4 text-[11px] text-slate-500 flex items-center justify-between pt-3 border-t border-slate-200/80">
                <span>
                  Delivery: <strong className="text-slate-800 font-mono">{offer.expectedHandover}</strong>
                </span>
                <span>
                  Milestones: <strong className="text-slate-800 font-mono">{offer.paymentMilestones.length} installments</strong>
                </span>
                <span>
                  DLD Fees: <strong className="text-slate-800 font-mono">{formatAED(acquisitionCost)}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DLD Project Selection and Edit Modal */}
      <ProjectSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetOptionIndex={modalOptionIndex}
        currentOffer={offers[modalOptionIndex]}
        onApplyOffer={(index, updated) => {
          onUpdateOffer?.(index, updated);
        }}
      />
    </div>
  );
}
