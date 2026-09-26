"use client";

import React from "react";
import { TimelinePoint, FundingStatus } from "@/domain/funding/evaluate-funding";
import { formatAED } from "@/lib/decimal";
import { Calendar, AlertCircle, CheckCircle2, Sliders, Shield, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface FundingTimelineSectionProps {
  timeline: TimelinePoint[];
  status: FundingStatus;
  statusReason: string;
  minHeadroom: number;
  initialCash: number;
  reserve: number;
  stressDelayMonths: number;
  onStressDelayChange: (months: number) => void;
}

export function FundingTimelineSection({
  timeline,
  status,
  statusReason,
  minHeadroom,
  initialCash,
  reserve,
  stressDelayMonths,
  onStressDelayChange,
}: FundingTimelineSectionProps) {
  // Compute max values for chart normalization
  const maxAmount = Math.max(
    ...timeline.map((pt) =>
      Math.max(
        pt.inflow.toNumber(),
        pt.payment.plus(pt.fee).toNumber(),
        Math.max(0, pt.headroom.toNumber())
      )
    ),
    1000000
  );

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Top Header & Stress Controllers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Step 3 &bull; Solvency Audit
              </span>
              <span className="text-xs font-mono text-slate-500">Section 24 Rule 4</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Chronological Cashflow &amp; Solvency Stress Test
            </h2>
          </div>
        </div>

        {/* Stress Testing Delay Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 text-xs self-start lg:self-auto shrink-0">
          <div className="flex items-center space-x-1.5 px-2.5 text-slate-500">
            <Sliders className="h-3.5 w-3.5 text-sky-600" />
            <span className="font-bold text-[11px] uppercase tracking-wider hidden sm:inline">Stress Delay:</span>
          </div>
          <button
            onClick={() => onStressDelayChange(0)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
              stressDelayMonths === 0
                ? "bg-white text-slate-900 border border-slate-200/80 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Baseline (0m)
          </button>
          <button
            onClick={() => onStressDelayChange(6)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
              stressDelayMonths === 6
                ? "bg-white text-amber-800 border border-amber-300 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            +6 Months
          </button>
          <button
            onClick={() => onStressDelayChange(12)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
              stressDelayMonths === 12
                ? "bg-white text-amber-800 border border-amber-300 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            +12 Months
          </button>
        </div>
      </div>

      {/* Visual Cashflow Bar Chart */}
      <div className="my-6 p-5 rounded-xl bg-slate-50 border border-slate-200/90">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
              Milestone Liquidity &amp; Cash Outflow Profile
            </span>
            <span className="text-[10px] text-slate-500 font-mono">({timeline.length} Event Horizons)</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              Inflow (+)
            </span>
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              Payment Out (-)
            </span>
            <span className="flex items-center gap-1.5 text-sky-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-600" />
              Liquid Headroom
            </span>
          </div>
        </div>

        {/* Visual Pill Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-2 pb-1 overflow-x-auto">
          {timeline.map((pt, idx) => {
            const outAmount = pt.payment.plus(pt.fee).toNumber();
            const inflowAmount = pt.inflow.toNumber();
            const headroomAmount = Math.max(0, pt.headroom.toNumber());
            const outPct = Math.min(100, Math.round((outAmount / maxAmount) * 100));
            const headroomPct = Math.min(100, Math.round((headroomAmount / maxAmount) * 100));

            return (
              <div
                key={idx}
                className="bg-white rounded-lg p-2.5 flex flex-col justify-between border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
              >
                {/* Bar Visualizer */}
                <div className="h-24 flex items-end justify-center gap-1.5 py-1">
                  {/* Outflow Bar */}
                  {outAmount > 0 && (
                    <div
                      style={{ height: `${Math.max(12, outPct)}%` }}
                      className="w-3 rounded-full bg-amber-500 shadow-sm"
                      title={`Outflow: ${formatAED(outAmount)}`}
                    />
                  )}
                  {/* Inflow Bar */}
                  {inflowAmount > 0 && (
                    <div
                      style={{ height: "45%" }}
                      className="w-3 rounded-full bg-emerald-500 shadow-sm"
                      title={`Inflow: ${formatAED(inflowAmount)}`}
                    />
                  )}
                  {/* Headroom Bar */}
                  <div
                    style={{ height: `${Math.max(10, headroomPct)}%` }}
                    className={`w-3 rounded-full ${
                      pt.isDeficit
                        ? "bg-rose-500 shadow-sm"
                        : "bg-sky-600 shadow-sm"
                    }`}
                    title={`Headroom: ${formatAED(headroomAmount)}`}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <div className="text-[10px] font-mono text-slate-500 font-semibold truncate">{pt.date}</div>
                  <div className="text-[9px] font-sans text-slate-700 font-medium truncate mt-0.5" title={pt.description}>
                    {pt.description}
                  </div>
                  <div className={`text-[10px] font-mono font-bold mt-1 ${pt.isDeficit ? "text-rose-600" : "text-emerald-700"}`}>
                    {formatAED(pt.headroom)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status banner */}
      <div
        className={`my-5 p-4 sm:p-5 rounded-xl border flex items-start space-x-3.5 text-xs transition-all ${
          status === "PASSED"
            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
            : status === "NOT_SUITABLE"
            ? "bg-rose-50 text-rose-900 border-rose-200"
            : "bg-amber-50 text-amber-900 border-amber-200"
        }`}
      >
        {status === "PASSED" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 w-full">
          <div className="font-bold flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider font-mono">
              Governance Audit Result: <span className="font-black">{status}</span>
            </span>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-900 shadow-sm">
              Min Safety Headroom: {formatAED(minHeadroom)}
            </span>
          </div>
          <p className="text-slate-600 text-xs leading-relaxed font-sans">{statusReason}</p>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider text-slate-600 bg-slate-50">
              <th className="py-3 px-4">Milestone Date</th>
              <th className="py-3 px-4">Event / Milestone Description</th>
              <th className="py-3 px-4 text-right">Inflow (+)</th>
              <th className="py-3 px-4 text-right">Payment / Fee (-)</th>
              <th className="py-3 px-4 text-right">Cum. Capital Out</th>
              <th className="py-3 px-4 text-right">Liquid Headroom (after reserve)</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {timeline.map((pt, idx) => {
              const hasInflow = pt.inflow.greaterThan(0);
              const hasPayment = pt.payment.greaterThan(0) || pt.fee.greaterThan(0);
              const outAmount = pt.payment.plus(pt.fee);

              return (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    pt.isDeficit ? "bg-rose-50/60 text-rose-900" : ""
                  }`}
                >
                  <td className="py-3 px-4 text-slate-600 font-semibold whitespace-nowrap">{pt.date}</td>
                  <td className="py-3 px-4 font-sans text-slate-800 font-medium">{pt.description}</td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-bold whitespace-nowrap">
                    {hasInflow ? `+${formatAED(pt.inflow)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-800 font-semibold whitespace-nowrap">
                    {hasPayment ? `-${formatAED(outAmount)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                    {formatAED(pt.cumulativePayment.plus(pt.cumulativeFee))}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                      pt.headroom.isNegative() ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    {formatAED(pt.headroom)}
                  </td>
                  <td className="py-3 px-4 text-center font-sans whitespace-nowrap">
                    {pt.isDeficit ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        DEFICIT
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        SOLVENT
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
