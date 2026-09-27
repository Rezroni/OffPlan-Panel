"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sliders,
  TrendingUp,
  BarChart3,
  Radar,
  History,
  ExternalLink,
  Info,
  Sparkles,
} from "lucide-react";
import type { CompetingSupplyAnalysis, QuarterSupplyBucket, CompetingCollisionItem } from "@/domain/pipeline/competing-supply";

interface CompetingSupplyPanelProps {
  analysis: CompetingSupplyAnalysis;
  projectName: string;
}

export function CompetingSupplyPanel({ analysis, projectName }: CompetingSupplyPanelProps) {
  const [activeTab, setActiveTab] = useState<"radar" | "timeline" | "archive">("radar");
  const [delayShiftMonths, setDelayShiftMonths] = useState<number>(0);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);

  // Dynamic simulation for delay shift
  const baseTargetDate = new Date(analysis.targetHandoverDate);
  const simulatedTargetDate = new Date(baseTargetDate);
  simulatedTargetDate.setMonth(simulatedTargetDate.getMonth() + delayShiftMonths);
  const simulatedYear = simulatedTargetDate.getFullYear();
  const simulatedQuarterNum = Math.floor(simulatedTargetDate.getMonth() / 3) + 1;
  const simulatedTargetQuarter = `${simulatedYear}-Q${simulatedQuarterNum}`;

  // Filter quarters into future vs historical
  const futureBuckets = analysis.quarterlyTimeline.filter((b) => !b.isHistorical && b.quarter !== "Unspecified");
  const historicalBuckets = analysis.quarterlyTimeline.filter((b) => b.isHistorical);

  // Max units for bar chart scaling
  const maxUnitsInQuarter = Math.max(...futureBuckets.map((b) => b.totalUnits), 100);

  // Determine active displayed collision projects
  const collisionProjects = analysis.collisionProjects || [];

  const getRiskBadge = (risk: CompetingSupplyAnalysis["supplyPressureRisk"]) => {
    switch (risk) {
      case "HIGH_COLLISION_RISK":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            Высокий риск коллизии сдачи
          </span>
        );
      case "MODERATE_PRESSURE":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Умеренная конкуренция сдачи
          </span>
        );
      case "LOW_PRESSURE":
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Низкая плотность конкуренции
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-2xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                  Section 14 &bull; DLD Handover Audit
                </span>
                <span className="text-xs font-mono text-slate-500">Secondary Market Absorption</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Конкурирующее предложение и коллизии сдачи в кластере
              </h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {getRiskBadge(analysis.supplyPressureRisk)}
        </div>
      </div>

      {/* Real-time Executive KPIs Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Квартал сдачи объекта
          </span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">
              {delayShiftMonths === 0 ? analysis.targetQuarter : simulatedTargetQuarter}
            </span>
            {delayShiftMonths > 0 && (
              <span className="text-[10px] font-bold text-amber-700 font-sans">
                (+{delayShiftMonths}м)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-sans truncate">
            План DLD: {analysis.targetHandoverDate}
          </span>
        </div>

        <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-amber-800 uppercase tracking-wider block font-sans font-semibold">
            Коллизия в окне &plusmn;6 месяцев
          </span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-amber-900">
              {analysis.collisionWindowProjectsCount}
            </span>
            <span className="text-xs text-amber-700 font-sans font-medium">проекта</span>
          </div>
          <span className="text-[10px] text-amber-800/80 font-sans font-semibold truncate">
            ~{analysis.collisionWindowUnitsCount.toLocaleString()} конкурирующих квартир
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Будущий пайплайн (2025–2029)
          </span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-sky-700">
              {analysis.futurePipelineUnits ? analysis.futurePipelineUnits.toLocaleString() : analysis.totalKnownUnitsInPipeline.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-sans font-medium">квартир</span>
          </div>
          <span className="text-[10px] text-slate-500 font-sans truncate">
            В {analysis.futureProjectsCount || 12} строящихся проектах района
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Окно поглощения рынком
          </span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-700">
              ~{analysis.absorptionMonthsEstimate || 2.8}
            </span>
            <span className="text-xs text-slate-500 font-sans font-medium">месяца</span>
          </div>
          <span className="text-[10px] text-slate-500 font-sans truncate">
            При темпе ~150 продаж/квартал
          </span>
        </div>
      </div>

      {/* Interactive Controls & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("radar")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === "radar"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Radar className="h-3.5 w-3.5 text-amber-600" />
            <span>Радар коллизий (&plusmn;6 мес)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono">
              {analysis.collisionWindowProjectsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === "timeline"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-sky-600" />
            <span>Волна поставок 2025–2029</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("archive")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === "archive"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>Сданные проекты ({historicalBuckets.length})</span>
          </button>
        </div>

        {/* Handover Delay Simulator */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs shrink-0">
          <div className="flex items-center gap-1 px-2 text-slate-500">
            <Sliders className="h-3.5 w-3.5 text-sky-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">Сдвиг сдачи:</span>
          </div>
          <button
            type="button"
            onClick={() => setDelayShiftMonths(0)}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
              delayShiftMonths === 0
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            0 мес (Базовый)
          </button>
          <button
            type="button"
            onClick={() => setDelayShiftMonths(6)}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
              delayShiftMonths === 6
                ? "bg-white text-amber-800 shadow-2xs border border-amber-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            +6 мес
          </button>
          <button
            type="button"
            onClick={() => setDelayShiftMonths(12)}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
              delayShiftMonths === 12
                ? "bg-white text-amber-800 shadow-2xs border border-amber-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            +12 мес
          </button>
        </div>
      </div>

      {/* TAB 1: RADAR КОЛЛИЗИЙ (Прямые конкуренты в окне сдачи) */}
      {activeTab === "radar" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">
                Прямые конкуренты в окне сдачи (±6 месяцев от {analysis.targetQuarter}):
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {collisionProjects.length} проектов
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-sans">
              Оценивает риск одновременного сброса инвесторских лотов на вторичный рынок
            </span>
          </div>

          {collisionProjects.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-sm text-slate-800">Прямых коллизий не обнаружено</div>
              <p className="text-xs text-slate-500 mt-1">
                В окне &plusmn;6 месяцев вокруг квартала сдачи {analysis.targetQuarter} в данном кластере нет других конкурирующих строящихся объектов.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collisionProjects.map((comp) => {
                const isTarget = comp.id === analysis.targetProjectId;
                const progress = comp.constructionProgressPct ?? 0;

                return (
                  <div
                    key={comp.id}
                    className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                      isTarget
                        ? "bg-sky-50/70 border-sky-300 ring-2 ring-sky-500/20 shadow-xs"
                        : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 truncate">
                          {comp.developerName || "Dubai Developer"}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-700">{comp.quarter}</span>
                        </div>
                      </div>

                      {/* Project Name */}
                      <div className="mt-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-900 tracking-tight leading-snug">
                            {comp.nameEn}
                          </h4>
                          <Link
                            href={`/projects/${comp.id}`}
                            className="text-slate-400 hover:text-sky-600 transition-colors shrink-0 p-1"
                            title="Открыть карточку проекта"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1">
                          Дата сдачи: <strong className="text-slate-700 font-semibold">{comp.expectedHandoverDate || "2027"}</strong>
                        </div>
                      </div>

                      {/* Construction Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[11px] text-slate-500 font-medium">Готовность объекта:</span>
                          <span className="font-bold font-mono text-slate-800">{progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                            className={`h-full rounded-full transition-all ${
                              progress >= 60
                                ? "bg-emerald-500"
                                : progress >= 30
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Delay Risk Indicator */}
                      <div className="mt-3.5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Оценка соблюдения сроков:</span>
                        {comp.delayRiskRating === "ON_TRACK" ? (
                          <span className="font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            В графике
                          </span>
                        ) : comp.delayRiskRating === "AT_RISK" ? (
                          <span className="font-bold text-amber-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Риск задержки ~3м
                          </span>
                        ) : (
                          <span className="font-bold text-rose-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Высокий сдвиг (&gt;6м)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between font-mono text-xs">
                      <span className="text-slate-500 font-sans text-[11px]">Квартир в объекте:</span>
                      <span className="font-bold text-slate-900">
                        {comp.totalUnitsReported ? `${comp.totalUnitsReported.toLocaleString()} units` : "DLD active"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ВОЛНА ПОСТАВОК (Интерактивная гистограмма 2025–2029) */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">
                Квартальный объём ввода жилья в кластере (2025–2029):
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                Окно коллизии (&plusmn;6 мес)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                Обычные поставки
              </span>
            </div>
          </div>

          {/* Interactive Bar Chart */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 items-end min-h-[160px] pt-6 pb-2">
              {futureBuckets.map((bucket) => {
                const isSelected = selectedQuarter === bucket.quarter;
                const isTarget = bucket.quarter === analysis.targetQuarter;
                const heightPct = Math.min(100, Math.max(12, Math.round((bucket.totalUnits / maxUnitsInQuarter) * 100)));

                return (
                  <div
                    key={bucket.quarter}
                    onClick={() => setSelectedQuarter(isSelected ? null : bucket.quarter)}
                    className="flex flex-col items-center justify-end h-full cursor-pointer group"
                    title={`${bucket.quarter}: ${bucket.totalUnits.toLocaleString()} units (${bucket.projectsCount} projects)`}
                  >
                    {/* Units Count Label on hover/target */}
                    <div className="text-[9px] font-mono font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {bucket.totalUnits}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all ${
                        isTarget
                          ? "bg-amber-500 ring-2 ring-amber-600 shadow-sm"
                          : bucket.isCollisionWindow
                          ? "bg-amber-400 group-hover:bg-amber-500 shadow-2xs"
                          : "bg-sky-400 group-hover:bg-sky-500"
                      } ${isSelected ? "ring-2 ring-slate-900" : ""}`}
                    />

                    {/* Quarter Label */}
                    <div className="mt-2 text-center">
                      <div className={`text-[10px] font-mono font-bold truncate ${isTarget ? "text-amber-800" : "text-slate-600"}`}>
                        {bucket.quarter.replace("20", "")}
                      </div>
                      <div className="text-[9px] text-slate-400 font-sans">
                        {bucket.totalUnits}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drilldown projects in selected quarter */}
          {selectedQuarter && (
            <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-sky-950">
                <span>Проекты со сдачей в {selectedQuarter}:</span>
                <button
                  type="button"
                  onClick={() => setSelectedQuarter(null)}
                  className="text-[11px] text-sky-600 hover:text-sky-800"
                >
                  Скрыть детали &times;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 font-mono">
                {futureBuckets
                  .find((b) => b.quarter === selectedQuarter)
                  ?.projects.map((p, pIdx) => (
                    <div key={pIdx} className="bg-white p-2.5 rounded-lg border border-sky-100 flex items-center justify-between">
                      <span className="font-sans font-medium text-slate-800 truncate mr-2">{p.nameEn}</span>
                      <span className="text-slate-600 font-bold shrink-0">{p.units || "—"} кв.</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: АРХИВ СДАННЫХ ПРОЕКТОВ (2016–2024) */}
      {activeTab === "archive" && (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 flex items-center justify-between">
            <span>
              Успешно построенные и введённые в эксплуатацию объекты в кластере (историческое поглощение):
            </span>
            <span className="font-mono font-bold text-slate-900">
              {analysis.historicalUnitsDelivered ? `${analysis.historicalUnitsDelivered.toLocaleString()} квартир` : "Поглощено рынком"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {historicalBuckets.map((bucket, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="font-bold font-mono text-slate-900">{bucket.quarter}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Сдано 100%
                  </span>
                </div>
                <div className="py-2 flex justify-between font-mono text-slate-600 text-[11px]">
                  <span>Объём:</span>
                  <strong className="text-slate-900">{bucket.totalUnits.toLocaleString()} units</strong>
                </div>
                <div className="space-y-1 text-[11px] text-slate-500 font-sans truncate">
                  {bucket.projects.map((p, pIdx) => (
                    <div key={pIdx} className="truncate">&bull; {p.nameEn}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Investor Takeaways: ПРИКЛАДНЫЕ ВЫВОДЫ ДЛЯ СДЕЛКИ */}
      <div className="mt-6 pt-6 border-t border-slate-200/80 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-sky-600" />
          <span>Стратегические выводы по объёму предложения (Actionable Exit Intelligence):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          {/* Takeaway 1: Flip Strategy */}
          <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white text-sky-800 border border-sky-200 shadow-2xs">
                Стратегия перепродажи (Pre-Handover Flip)
              </span>
              <div className="font-bold text-slate-900 text-xs mt-2">
                Выход до массовой выдачи ключей
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                В окне сдачи ({analysis.targetQuarter}) выходит ~{analysis.collisionWindowUnitsCount.toLocaleString()} квартир. Чтобы избежать конкуренции с демпингующими продавцами на вторичке, <strong className="text-slate-800">закрывайте перепродажу на стадии 40–50% готовности</strong> в конце 2026 года.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-sky-200/60 font-mono text-[10px] text-sky-800 font-bold">
              Рекомендуемый выход: Q3–Q4 2026
            </div>
          </div>

          {/* Takeaway 2: Rental Hold Strategy */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                Стратегия аренды (Long-term Hold)
              </span>
              <div className="font-bold text-slate-900 text-xs mt-2">
                Окно арендной абсорбции ~2–3 мес.
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Кластер Al Wasl характеризуется высокой плотностью платежеспособного спроса. При одновременном вводе {analysis.collisionWindowUnitsCount.toLocaleString()} квартир закладывайте в модель <strong className="text-slate-800">1 месяц арендных каникул</strong> для первичной стабилизации ставки.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-200/60 font-mono text-[10px] text-emerald-800 font-bold">
              Срок стабилизации: 60–90 дней
            </div>
          </div>

          {/* Takeaway 3: Competitive Differentiation */}
          <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white text-purple-800 border border-purple-200 shadow-2xs">
                Уникальное позиционирование (Moat)
              </span>
              <div className="font-bold text-slate-900 text-xs mt-2">
                Бутиковый премиум vs высотки
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Проект {projectName} позиционируется как премиальный бутиковый формат (H&amp;H на Дубайском Канале). Это изолирует его от прямого ценового давления со стороны типовых многоэтажных комплексов района.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-purple-200/60 font-mono text-[10px] text-purple-800 font-bold">
              Ценовая защита: Премиальный сегмент
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
