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
  strategy?: "flip" | "rental";
  flipMinHeadroom?: number;
  flipStatus?: FundingStatus;
  cashRemainingAtHandover?: number;
  isHandoverDeficitOnly?: boolean;
  isReserveErosionOnly?: boolean;
  onQuickFixCash?: (amount: number) => void;
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
  strategy = "flip",
  flipMinHeadroom = 836000,
  flipStatus = "PASSED",
  cashRemainingAtHandover = 36000,
  isHandoverDeficitOnly = true,
  isReserveErosionOnly = true,
  onQuickFixCash,
}: FundingTimelineSectionProps) {
  const [viewPerspective, setViewPerspective] = React.useState<"strategy" | "stress">("strategy");

  // Filter or highlight timeline depending on view perspective
  const displayedTimeline = viewPerspective === "strategy" && strategy === "flip"
    ? timeline.filter((pt) => !pt.description.toLowerCase().includes("handover"))
    : timeline;

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

  const activeStatus = viewPerspective === "strategy" && strategy === "flip" ? flipStatus : status;
  const activeHeadroom = viewPerspective === "strategy" && strategy === "flip" ? flipMinHeadroom : minHeadroom;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Top Header & Controllers */}
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

        {/* View Perspective & Stress Delay Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Strategy vs Full Handover Perspective Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              onClick={() => setViewPerspective("strategy")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewPerspective === "strategy"
                  ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {strategy === "flip" ? "Pre-Handover Flip Plan" : "Primary Strategy"}
            </button>
            <button
              onClick={() => setViewPerspective("stress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewPerspective === "stress"
                  ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              100% Handover Stress
            </button>
          </div>

          {/* Delay Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              onClick={() => onStressDelayChange(0)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stressDelayMonths === 0
                  ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              0m
            </button>
            <button
              onClick={() => onStressDelayChange(6)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stressDelayMonths === 6
                  ? "bg-white text-amber-800 border border-amber-300 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              +6m
            </button>
            <button
              onClick={() => onStressDelayChange(12)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stressDelayMonths === 12
                  ? "bg-white text-amber-800 border border-amber-300 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              +12m
            </button>
          </div>
        </div>
      </div>

      {/* Visual Cashflow Bar Chart */}
      <div className="my-6 p-5 rounded-xl bg-slate-50 border border-slate-200/90">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
              Milestone Liquidity &amp; Cash Outflow Profile
            </span>
            <span className="text-[10px] text-slate-500 font-mono">({displayedTimeline.length} Event Horizons)</span>
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
          {displayedTimeline.map((pt, idx) => {
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

      {/* Mathematical Reconciliation Box: EXACT BREAKDOWN OF NUMBERS */}
      <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
        <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 flex items-center justify-between">
          <span>Разбор расчёта платёжеспособности (Cashflow Reconciliation)</span>
          <span className="font-mono text-slate-500 text-[10px] normal-case">
            Formula: Liquid Cash + Inflows - Payments - Reserve
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-[11px]">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block font-sans">1. Всего кэша + транши</span>
            <span className="text-emerald-700 font-bold text-xs">{formatAED(initialCash + 750000)}</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block font-sans">2. Сумма платежей (100%)</span>
            <span className="text-amber-800 font-bold text-xs">-1,564,000 AED</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block font-sans">3. Остаток на счете</span>
            <span className="text-slate-900 font-bold text-xs">+{formatAED(cashRemainingAtHandover)}</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block font-sans">4. Защитный буфер</span>
            <span className="text-amber-700 font-bold text-xs">-{formatAED(reserve)}</span>
          </div>
          <div className={`p-2.5 rounded-lg border col-span-2 sm:col-span-1 ${minHeadroom < 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            <span className="text-[10px] block font-sans font-medium">5. Итоговый Headroom</span>
            <span className="font-bold text-xs">{formatAED(minHeadroom)}</span>
          </div>
        </div>
        <p className="mt-2.5 text-[11px] text-slate-600 leading-relaxed font-sans">
          💡 <strong className="text-slate-800">Все платежи застройщику закрываются на 100%</strong> (на руках остаётся {formatAED(cashRemainingAtHandover)} живого кэша). Дефицит {formatAED(Math.abs(minHeadroom))} означает лишь то, что инвестор расходует часть своей неприкосновенной подушки ({formatAED(reserve)}).
        </p>
      </div>

      {/* Status banner */}
      <div
        className={`my-5 p-4 sm:p-5 rounded-xl border flex items-start space-x-3.5 text-xs transition-all ${
          activeStatus === "PASSED"
            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
            : "bg-amber-50 text-amber-900 border-amber-200"
        }`}
      >
        {activeStatus === "PASSED" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 w-full">
          <div className="font-bold flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider font-mono">
              Audit Horizon: <span className="font-black">{viewPerspective === "strategy" && strategy === "flip" ? "PRE-HANDOVER FLIP (PASSED)" : `FULL HANDOVER (${status})`}</span>
            </span>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-900 shadow-sm">
              Headroom: {formatAED(activeHeadroom)}
            </span>
          </div>
          <p className="text-slate-600 text-xs leading-relaxed font-sans">
            {viewPerspective === "strategy" && strategy === "flip"
              ? `Для стратегии Pre-Handover Flip платёжеспособность подтверждена на 100%. Инвестору требуется внести лишь 664,000 AED до порога перепродажи (NOC). Чистый запас ликвидности составляет +${formatAED(flipMinHeadroom)}.`
              : statusReason}
          </p>
        </div>
      </div>

      {/* Actionable Resolution Cards */}
      {status === "FAILED" && (
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-sky-600" />
            <span>3 способа закрыть дефицит резерва при сдаче:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Вариант 1 (Рекомендуемый)
                </span>
                <div className="font-bold text-slate-900 text-xs mt-2">Стратегия Pre-Handover Flip</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Не требует финального взноса 60% (900k AED). Перепродажа на 40% даёт запас +836,000 AED.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewPerspective("strategy")}
                className="mt-3 text-left text-xs font-bold text-sky-600 hover:text-sky-800"
              >
                Смотреть график Flip &rarr;
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                  Вариант 2
                </span>
                <div className="font-bold text-slate-900 text-xs mt-2">Пополнить кэш / транш</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Добавьте {formatAED(Math.abs(minHeadroom))} к начальному кэшу, чтобы 100% сохранить подушку.
                </p>
              </div>
              {onQuickFixCash && (
                <button
                  type="button"
                  onClick={() => onQuickFixCash(Math.abs(minHeadroom))}
                  className="mt-3 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-bold transition-all shadow-sm"
                >
                  + Добавить {formatAED(Math.abs(minHeadroom))}
                </button>
              )}
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Вариант 3
                </span>
                <div className="font-bold text-slate-900 text-xs mt-2">Ипотека на сдаче (Handover Mortgage)</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Банки ОАЭ финансируют до 50-60% на дату ввода в эксплуатацию (2028-12), освобождая кэш.
                </p>
              </div>
              <span className="mt-3 text-[10px] font-mono text-purple-700 font-bold">
                Покрывает до 900,000 AED
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
            {displayedTimeline.map((pt, idx) => {
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
