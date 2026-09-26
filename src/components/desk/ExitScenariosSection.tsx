"use client";

import React from "react";
import { TrendingUp, TrendingDown, Target, HelpCircle, ShieldAlert, Award } from "lucide-react";
import { formatAED, formatPercent } from "@/lib/decimal";
import { calculatePeriodReturn, calculateBreakEven } from "@/domain/returns/calculate-period-return";
import { OfferData } from "./OfferComparisonSection";

interface ExitScenariosSectionProps {
  selectedOffer: OfferData;
}

export function ExitScenariosSection({ selectedOffer }: ExitScenariosSectionProps) {
  const contractPrice = selectedOffer.contractPrice;
  const acquisitionCosts = selectedOffer.fees.reduce((acc, f) => acc + f.amount, 0);

  // Capital paid up to flip exit (e.g. 40% before handover)
  const paidCapital = selectedOffer.paymentMilestones
    .filter((m) => !m.description.toLowerCase().includes("handover"))
    .reduce((acc, m) => acc + m.amount, 0);

  const breakEven = calculateBreakEven({
    contractPrice,
    acquisitionCosts,
    fixedExitCosts: 10000,
    variableExitRate: 0.02,
  });

  const scenarios = [
    {
      name: "Bearish Exit (-10% Stress)",
      badge: "Bearish (-10%)",
      resalePrice: contractPrice * 0.90,
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      cardBg: "bg-rose-50/30 border-rose-200 hover:border-rose-300",
      description: "Market softening during construction. Unit resold at a 10% discount to original contract price.",
    },
    {
      name: "Baseline Exit (+10% Nominal)",
      badge: "Baseline (+10%)",
      resalePrice: contractPrice * 1.10,
      badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
      cardBg: "bg-sky-50/30 border-sky-200 hover:border-sky-300",
      description: "Conservative market trend based on historical inflation and master-developer phasing.",
    },
    {
      name: "Bullish Exit (+20% Demand)",
      badge: "Bullish (+20%)",
      resalePrice: contractPrice * 1.20,
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      cardBg: "bg-emerald-50/30 border-emerald-200 hover:border-emerald-300",
      description: "Strong demand surge in prime cluster closer to delivery and infrastructure handover.",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Step 4 &bull; Exit Economics
              </span>
              <span className="text-xs font-mono text-slate-500">Section 24 Rule 1 &amp; 2</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Exit Scenarios &amp; Downside Protection &mdash;{" "}
              <span className="text-sky-700">{selectedOffer.projectName}</span>
            </h2>
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 text-right shrink-0 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Exact Break-Even Resale Price
          </div>
          <div className="text-lg font-black text-slate-900 font-mono tracking-tight mt-0.5">
            {formatAED(breakEven)}
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-6">
        {scenarios.map((sc, idx) => {
          const exitCosts = 10000 + (sc.resalePrice * 0.02);
          const res = calculatePeriodReturn({
            contractPrice,
            paidCapital,
            acquisitionCosts,
            resalePrice: sc.resalePrice,
            exitCosts,
          });

          return (
            <div
              key={idx}
              className={`${sc.cardBg} border rounded-xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    S = {formatAED(sc.resalePrice)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{sc.name}</h3>
                <p className="text-xs text-slate-600 my-2.5 leading-relaxed">{sc.description}</p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-200/80 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Seller Receipt:</span>
                  <span className="text-slate-800 font-semibold">{formatAED(res.sellerReceipt)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Invested Capital:</span>
                  <span className="text-slate-800 font-semibold">{formatAED(res.investedCash)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200/80 font-bold">
                  <span className="text-slate-700 font-sans">Net Profit AED:</span>
                  <span className={`font-mono text-base ${res.netProfit.greaterThan(0) ? "text-emerald-700 font-black" : "text-rose-600 font-black"}`}>
                    {formatAED(res.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-700 font-sans">Cash-on-Cash ROI:</span>
                  <span className={`font-mono text-base ${res.returnOnInvestedCash.greaterThan(0) ? "text-emerald-700 font-black" : "text-rose-600 font-black"}`}>
                    {formatPercent(res.returnOnInvestedCash)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
