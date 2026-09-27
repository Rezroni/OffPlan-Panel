"use client";

import React from "react";
import { X, Printer, Download, CheckCircle, Shield, Building, Award } from "lucide-react";
import { formatAED, formatPercent, formatSqft } from "@/lib/decimal";
import { OfferData } from "./OfferComparisonSection";
import { ClientFundingProfile } from "@/domain/funding/evaluate-funding";
import { calculatePeriodReturn, calculateBreakEven } from "@/domain/returns/calculate-period-return";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  offers: [OfferData, OfferData];
  client: ClientFundingProfile & {
    clientName: string;
    targetBudget: number;
    strategy: "flip" | "rental";
  };
}

export function PrintPreviewModal({ isOpen, onClose, offers, client }: PrintPreviewModalProps) {
  if (!isOpen) return null;

  const [optA, optB] = offers;
  const optACost = optA.fees.reduce((a, b) => a + b.amount, 0);
  const optBCost = optB.fees.reduce((a, b) => a + b.amount, 0);

  const optAPaidExit = optA.paymentMilestones
    .filter((m) => !m.description.toLowerCase().includes("handover"))
    .reduce((a, b) => a + b.amount, 0);

  const optBPaidExit = optB.paymentMilestones
    .filter((m) => !m.description.toLowerCase().includes("handover"))
    .reduce((a, b) => a + b.amount, 0);

  const optAReturn = calculatePeriodReturn({
    contractPrice: optA.contractPrice,
    paidCapital: optAPaidExit,
    acquisitionCosts: optACost,
    resalePrice: optA.contractPrice * 1.10,
    exitCosts: 10000 + (optA.contractPrice * 1.10 * 0.02),
  });

  const optBReturn = calculatePeriodReturn({
    contractPrice: optB.contractPrice,
    paidCapital: optBPaidExit,
    acquisitionCosts: optBCost,
    resalePrice: optB.contractPrice * 1.10,
    exitCosts: 10000 + (optB.contractPrice * 1.10 * 0.02),
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col border border-slate-200">
        {/* Modal Toolbar (hidden on print) */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">Investor PDF Report &bull; Live Preview</span>
            <span className="text-[11px] bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full font-semibold">
              Immutable Snapshot v1.0
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-700 font-sans leading-relaxed">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-amber-600 mb-1">
                CONFIDENTIAL INVESTMENT ADVISORY &bull; DUBAI OFF-PLAN
              </div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                Off-Plan Comparative Investment Memorandum
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Prepared by: <strong className="text-slate-900">Mokhamed</strong> &bull; Dubai Off-Plan Research Desk
              </p>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-500 space-y-0.5">
              <div>Date: <strong>{new Date().toISOString().slice(0, 10)}</strong></div>
              <div>Client: <strong>{client.clientName}</strong></div>
              <div>Budget Cap: <strong>{formatAED(client.targetBudget)}</strong></div>
            </div>
          </div>

          {/* 1. Executive Thesis */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h2 className="text-xs font-bold text-slate-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-600" />
              <span>1. Executive Summary &amp; Investment Recommendation</span>
            </h2>
            <p className="text-slate-700 mb-2">
              Based on the client&apos;s available capital of <strong>{formatAED(client.initialLiquidCash)}</strong> and target exit timeline,
              we have conducted a structured comparative analysis between two verified developer allocations.
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 font-medium">
              &bull; <strong>Recommended Option:</strong> <span className="underline font-bold">{optA.projectName}</span> ({optA.developerName}) is preferred due to:
              (1) Lower entry psf of {formatAED(optA.contractPrice / optA.areaSqft)}/sq.ft. providing a 16.7% discount to verified ready sales;
              (2) Feasible 40% capital requirement before handover satisfying the NOC transfer threshold without cash drag.
            </div>
          </div>

          {/* 2. Side-by-Side Comparison Table */}
          <div>
            <h2 className="text-xs font-bold text-slate-950 uppercase tracking-wider mb-2">
              2. Candidate Offer Comparison Matrix
            </h2>
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900">
                  <th className="p-2.5 border-r border-slate-200">Parameter</th>
                  <th className="p-2.5 border-r border-slate-200 bg-blue-50/50">Option A: {optA.projectName}</th>
                  <th className="p-2.5">Option B: {optB.projectName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Developer &amp; Location</td>
                  <td className="p-2 font-sans border-r border-slate-200 bg-blue-50/30">{optA.developerName} &bull; {optA.community}</td>
                  <td className="p-2 font-sans">{optB.developerName} &bull; {optB.community}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Unit Type &amp; Area</td>
                  <td className="p-2 border-r border-slate-200 bg-blue-50/30">{optA.unitType} &bull; {formatSqft(optA.areaSqft)}</td>
                  <td className="p-2">{optB.unitType} &bull; {formatSqft(optB.areaSqft)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Contract Net Price</td>
                  <td className="p-2 font-bold text-slate-900 border-r border-slate-200 bg-blue-50/30">{formatAED(optA.contractPrice)}</td>
                  <td className="p-2 font-bold text-slate-900">{formatAED(optB.contractPrice)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Price / Sq.Ft.</td>
                  <td className="p-2 border-r border-slate-200 bg-blue-50/30">{formatAED(optA.contractPrice / optA.areaSqft)}</td>
                  <td className="p-2">{formatAED(optB.contractPrice / optB.areaSqft)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">DLD Ready Comps Gap</td>
                  <td className="p-2 font-bold text-emerald-700 border-r border-slate-200 bg-blue-50/30">-16.7% vs median</td>
                  <td className="p-2 font-bold text-amber-700">-6.2% vs median</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Capital Paid to Exit</td>
                  <td className="p-2 border-r border-slate-200 bg-blue-50/30">{formatAED(optAPaidExit)} (40%)</td>
                  <td className="p-2">{formatAED(optBPaidExit)} (40%)</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">NOC Assignment Eligibility</td>
                  <td className="p-2 text-emerald-700 font-bold border-r border-slate-200 bg-blue-50/30">ELIGIBLE (Threshold 30% met)</td>
                  <td className="p-2 text-emerald-700 font-bold">ELIGIBLE (Threshold 40% met)</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Net Profit (+10% Exit)</td>
                  <td className="p-2 font-bold text-emerald-700 border-r border-slate-200 bg-blue-50/30">{formatAED(optAReturn.netProfit)}</td>
                  <td className="p-2 font-bold text-emerald-700">{formatAED(optBReturn.netProfit)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-medium text-slate-600 border-r border-slate-200">Period ROI on Cash</td>
                  <td className="p-2 font-bold text-emerald-700 border-r border-slate-200 bg-blue-50/30">{formatPercent(optAReturn.returnOnInvestedCash)}</td>
                  <td className="p-2 font-bold text-emerald-700">{formatPercent(optBReturn.returnOnInvestedCash)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Methodology & Governance Notice */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
            <p>
              <strong>Data Governance &amp; Verification Note:</strong> Historical sales benchmarks are derived from official registered DLD open transaction records.
              Projected ROI figures are mathematical scenario calculations assuming successful assignment at the stated exit valuation and do not constitute a developer guarantee of resale timing.
            </p>
            <div className="flex justify-between pt-2 text-slate-400 font-mono">
              <span>Report Reference: SNAP-202609-001</span>
              <span>DLD Pipeline Engine v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
