"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Layers,
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Filter,
  Info,
  Clock,
} from "lucide-react";
import type { CMAResult } from "@/domain/cma/comparable-set";

type Props = {
  initialData: {
    project: {
      id: string;
      nameEn: string;
      developerBrand: string | null;
      areaNameEn: string | null;
      expectedHandoverDate: string | null;
    } | null;
    cma: CMAResult;
  };
};

export function CmaAnalysisClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [bedrooms, setBedrooms] = useState(1);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);

  const project = data.project;
  const cma = data.cma;

  const handleFilterChange = async (newBedrooms: number, newMonths: number) => {
    setBedrooms(newBedrooms);
    setMonths(newMonths);
    if (!project) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cma/${project.id}?bedrooms=${newBedrooms}&months=${newMonths}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to re-fetch CMA:", err);
    } finally {
      setLoading(false);
    }
  };

  const getReliabilityBadge = (rel: string) => {
    switch (rel) {
      case "ROBUST":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Robust Sample (≥15 sales, ≥3 buildings)
          </span>
        );
      case "WEAK_SAMPLE":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Weak Sample (5–14 sales)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 border border-rose-200/80 text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Insufficient Sample (&lt;5 sales)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <Link
            href={project ? `/projects/${project.id}` : "/discover"}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Project Overview
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Building2 className="h-7 w-7 text-sky-600" />
            {project?.nameEn || "Project"} — CMA 3-Group Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Section 7 Comparative Market Analysis against DLD registered sales in{" "}
            <span className="text-sky-700 font-semibold">{project?.areaNameEn || "Dubai"}</span>
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 bg-white border border-slate-200/90 p-1.5 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1 text-xs text-slate-400 pl-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-500">Format:</span>
          </div>
          {[0, 1, 2, 3].map((br) => (
            <button
              key={br}
              onClick={() => handleFilterChange(br, months)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                bedrooms === br
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {br === 0 ? "Studio" : `${br}BR`}
            </button>
          ))}
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-500">Window:</span>
          </div>
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => handleFilterChange(bedrooms, m)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                months === m
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3 text-xs text-sky-800 flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
          Recalculating 3-group comparables...
        </div>
      )}

      {/* Primary KPI Gap Summary Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Target Unit Asking Benchmark ({bedrooms === 0 ? "Studio" : `${bedrooms}BR`})
            </div>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-3xl font-extrabold text-slate-900">
                {Number(cma.targetPsf).toFixed(0)} <span className="text-sm font-normal text-slate-500">AED/sq.ft.</span>
              </span>
              <span className="text-slate-500 text-sm">
                (Total: {Number(cma.targetPrice) >= 1_000_000 ? `AED ${(Number(cma.targetPrice) / 1_000_000).toFixed(2)}M` : `AED ${Math.round(Number(cma.targetPrice) / 1000)}k`} · {Number(cma.targetAreaSqft).toFixed(0)} sq.ft.)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                Gap to Ready Median
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                {cma.gapToReadyPercent !== null ? (
                  Number(cma.gapToReadyPercent) > 0 ? (
                    <span className="text-2xl font-black text-emerald-600 flex items-center">
                      <TrendingDown className="h-5 w-5 mr-1" />
                      -{Number(cma.gapToReadyPercent).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-2xl font-black text-rose-600 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-1" />
                      +{Math.abs(Number(cma.gapToReadyPercent)).toFixed(1)}%
                    </span>
                  )
                ) : (
                  <span className="text-sm text-slate-500 font-medium">BLOCKED (Small Sample)</span>
                )}
              </div>
            </div>

            <div className="text-right border-l border-slate-200 pl-6">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Sample Reliability
              </div>
              <div className="mt-0.5">
                {getReliabilityBadge(cma.readyGroup.reliability)}
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Rule-based Conclusion (§7.3) */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-slate-700">
          <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900 font-bold">Methodological Synthesis (§7): </strong>
            {cma.editorialConclusion}
            <div className="text-slate-500 mt-1">
              Note: Observed gap does not constitute guaranteed under-pricing. It excludes holding time, construction risk, and unverified floor/view premiums.
            </div>
          </div>
        </div>
      </div>

      {/* Three Independent Groups (§7.1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Group A: Ready */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              Group A: Ready
            </span>
            <span className="text-xs text-slate-500 font-mono">{cma.readyGroup.count} registered sales</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">
              {cma.readyGroup.medianPsf ? `${Number(cma.readyGroup.medianPsf).toFixed(0)} AED` : "—"}
              <span className="text-xs font-normal text-slate-500 ml-1">median / sq.ft.</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              IQR (P25–P75):{" "}
              <strong className="text-slate-700 font-mono">
                {cma.readyGroup.p25Psf ? Number(cma.readyGroup.p25Psf).toFixed(0) : "—"} –{" "}
                {cma.readyGroup.p75Psf ? Number(cma.readyGroup.p75Psf).toFixed(0) : "—"} AED
              </strong>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span>Distinct Buildings:</span>
              <strong className="text-slate-900 font-semibold">{cma.readyGroup.distinctBuildings}</strong>
            </div>
            <div className="flex justify-between">
              <span>Dominant Building:</span>
              <span className="text-slate-800 font-medium truncate max-w-[150px]">
                {cma.readyGroup.dominantBuildingName || "None"} ({cma.readyGroup.maxBuildingSharePct}%)
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            {cma.readyGroup.reliabilityNote}
          </div>
        </div>

        {/* Group B: Comparable Off-Plan */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200/60">
              Group B: Off-Plan Comps
            </span>
            <span className="text-xs text-slate-500 font-mono">{cma.offPlanGroup.count} registered sales</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">
              {cma.offPlanGroup.medianPsf ? `${Number(cma.offPlanGroup.medianPsf).toFixed(0)} AED` : "—"}
              <span className="text-xs font-normal text-slate-500 ml-1">median / sq.ft.</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              IQR (P25–P75):{" "}
              <strong className="text-slate-700 font-mono">
                {cma.offPlanGroup.p25Psf ? Number(cma.offPlanGroup.p25Psf).toFixed(0) : "—"} –{" "}
                {cma.offPlanGroup.p75Psf ? Number(cma.offPlanGroup.p75Psf).toFixed(0) : "—"} AED
              </strong>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span>Distinct Projects:</span>
              <strong className="text-slate-900 font-semibold">{cma.offPlanGroup.distinctBuildings}</strong>
            </div>
            <div className="flex justify-between">
              <span>Gap to Off-Plan Median:</span>
              <span className="text-slate-900 font-semibold">
                {cma.gapToOffPlanPercent !== null
                  ? `${Number(cma.gapToOffPlanPercent).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            {cma.offPlanGroup.reliabilityNote}
          </div>
        </div>

        {/* Group C: Near-Handover */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/60">
              Group C: Near-Handover
            </span>
            <span className="text-xs text-slate-500 font-mono">{cma.nearHandoverGroup.count} sales</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">
              {cma.nearHandoverGroup.medianPsf ? `${Number(cma.nearHandoverGroup.medianPsf).toFixed(0)} AED` : "—"}
              <span className="text-xs font-normal text-slate-500 ml-1">median / sq.ft.</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Provides pricing benchmark for developments delivering in advance of target project.
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span>Sample Reliability:</span>
              <strong className="text-purple-700 font-semibold">{cma.nearHandoverGroup.reliability}</strong>
            </div>
            <div className="flex justify-between">
              <span>Buildings Represented:</span>
              <span className="text-slate-900 font-semibold">{cma.nearHandoverGroup.distinctBuildings}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            {cma.nearHandoverGroup.reliabilityNote}
          </div>
        </div>
      </div>

      {/* Building Concentration Breakdown (§7.2 step 8) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          Building Distribution Breakdown (Ready Sales)
        </h3>
        <p className="text-xs text-slate-500">
          Showing volume and median price per square foot across specific towers in the cluster. Flagged if single-tower concentration exceeds 70%.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-4 rounded-l-xl font-semibold">Building Name</th>
                <th className="py-2.5 px-4 text-center font-semibold">Transactions</th>
                <th className="py-2.5 px-4 text-center font-semibold">Share of Sample</th>
                <th className="py-2.5 px-4 text-right rounded-r-xl font-semibold">Median PSF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cma.readyGroup.buildingBreakdown.slice(0, 8).map((b, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {b.buildingName}
                    {b.sharePct >= 70 && (
                      <span className="bg-amber-50 text-amber-800 text-[10px] px-1.5 py-0.5 rounded border border-amber-200/80 font-medium">
                        Dominant ({b.sharePct}%)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-600 font-mono">{b.count}</td>
                  <td className="py-2.5 px-4 text-center text-slate-600 font-mono">{b.sharePct}%</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-600 font-mono">
                    {b.medianPsf ? `${Number(b.medianPsf).toFixed(0)} AED` : "—"}
                  </td>
                </tr>
              ))}
              {cma.readyGroup.buildingBreakdown.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No registered ready sales available in this cluster for the chosen filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
