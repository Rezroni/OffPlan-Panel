"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sliders,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import type { CMAResult, TransactionFact } from "@/domain/cma/comparable-set";

type UnitTypeInfo = {
  id?: string;
  bedrooms: number | null;
  unitTypeLabel?: string | null;
  areaSqftMin?: number | null;
  areaSqftMax?: number | null;
  listPriceAed?: number | null;
  netPriceAed?: number | null;
};

type Props = {
  projectId: string;
  projectName: string;
  areaName: string;
  expectedHandoverDate?: string | null;
  initialCma: CMAResult;
  activeBedroom: number;
  activeUnit?: UnitTypeInfo | null;
  unitTypes: UnitTypeInfo[];
  onSelectBedroom: (bed: number) => void;
};

// Safe number parser for serialized JSON or Decimal objects
function toNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof val === "object" && "toNumber" in (val as any)) {
    try {
      return (val as any).toNumber();
    } catch {
      return null;
    }
  }
  return null;
}

function formatAed(val: number | null): string {
  if (val === null || isNaN(val) || val === 0) return "—";
  if (Math.abs(val) >= 1_000_000) {
    return `AED ${(val / 1_000_000).toFixed(2)}M`;
  }
  return `AED ${Math.round(val).toLocaleString("en-US")}`;
}

function formatPsf(val: number | null): string {
  if (val === null || isNaN(val) || val === 0) return "—";
  return `${Math.round(val).toLocaleString("en-US")} AED/sqft`;
}

function formatArea(val: number | null): string {
  if (val === null || isNaN(val) || val === 0) return "—";
  return `${Math.round(val).toLocaleString("en-US")} sqft`;
}

function bedroomLabel(bed: number | null): string {
  if (bed === null || bed === undefined) return "Apartment";
  if (bed === 0) return "Studio";
  return `${bed}BR`;
}

export function CmaSection({
  projectId,
  projectName,
  areaName,
  expectedHandoverDate,
  initialCma,
  activeBedroom,
  activeUnit,
  unitTypes,
  onSelectBedroom,
}: Props) {
  // Local state
  const [cma, setCma] = useState<CMAResult>(initialCma);
  const [loading, setLoading] = useState(false);
  const [monthsWindow, setMonthsWindow] = useState<number>(12);
  const [priceBasis, setPriceBasis] = useState<"net" | "list" | "custom">("net");
  const [customPriceInput, setCustomPriceInput] = useState<string>("");
  const [customPsfInput, setCustomPsfInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "towers" | "transactions" | "simulator">("overview");

  // Transactions feed filter & search
  const [txFilter, setTxFilter] = useState<"all" | "offplan" | "ready" | "near">("all");
  const [txSearch, setTxSearch] = useState<string>("");
  const [txPageSize, setTxPageSize] = useState<number>(10);

  // Sync initialCma updates from parent
  useEffect(() => {
    setCma(initialCma);
  }, [initialCma]);

  // Handle bedroom or timeframe change
  const fetchCma = async (
    br: number,
    months: number,
    customPrice?: number,
    customArea?: number
  ) => {
    setLoading(true);
    try {
      let url = `/api/cma/${projectId}?bedrooms=${br}&months=${months}`;
      if (customPrice && customPrice > 0) {
        url += `&price=${customPrice}`;
      }
      if (customArea && customArea > 0) {
        url += `&area=${customArea}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setCma(json.cma);
      }
    } catch (err) {
      console.error("Failed to re-fetch CMA:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBedClick = (br: number) => {
    onSelectBedroom(br);
    const unit = unitTypes.find((u) => u.bedrooms === br);
    const price = priceBasis === "list" ? unit?.listPriceAed : unit?.netPriceAed;
    const avgArea = unit?.areaSqftMin && unit?.areaSqftMax
      ? (unit.areaSqftMin + unit.areaSqftMax) / 2
      : unit?.areaSqftMin || unit?.areaSqftMax || undefined;

    fetchCma(br, monthsWindow, price || undefined, avgArea || undefined);
  };

  const handleMonthsChange = (months: number) => {
    setMonthsWindow(months);
    const unit = unitTypes.find((u) => u.bedrooms === activeBedroom);
    const price = priceBasis === "list" ? unit?.listPriceAed : unit?.netPriceAed;
    const avgArea = unit?.areaSqftMin && unit?.areaSqftMax
      ? (unit.areaSqftMin + unit.areaSqftMax) / 2
      : unit?.areaSqftMin || unit?.areaSqftMax || undefined;

    fetchCma(activeBedroom, months, price || undefined, avgArea || undefined);
  };

  const handlePriceBasisChange = (basis: "net" | "list" | "custom") => {
    setPriceBasis(basis);
    if (basis === "custom") {
      setActiveTab("simulator");
      return;
    }
    const unit = unitTypes.find((u) => u.bedrooms === activeBedroom);
    const price = basis === "list" ? unit?.listPriceAed : unit?.netPriceAed;
    const avgArea = unit?.areaSqftMin && unit?.areaSqftMax
      ? (unit.areaSqftMin + unit.areaSqftMax) / 2
      : unit?.areaSqftMin || unit?.areaSqftMax || undefined;

    fetchCma(activeBedroom, monthsWindow, price || undefined, avgArea || undefined);
  };

  // Numerical metrics
  const targetPsf = toNum(cma.targetPsf) ?? 2030;
  const targetPrice = toNum(cma.targetPrice) ?? 1547000;
  const targetArea = toNum(cma.targetAreaSqft) ?? 762;

  const readyMedianPsf = toNum(cma.readyGroup?.medianPsf);
  const readyMedianPrice = toNum(cma.readyGroup?.medianPriceAed);
  const readyP25Psf = toNum(cma.readyGroup?.p25Psf);
  const readyP75Psf = toNum(cma.readyGroup?.p75Psf);

  const offPlanMedianPsf = toNum(cma.offPlanGroup?.medianPsf);
  const offPlanMedianPrice = toNum(cma.offPlanGroup?.medianPriceAed);
  const offPlanP25Psf = toNum(cma.offPlanGroup?.p25Psf);
  const offPlanP75Psf = toNum(cma.offPlanGroup?.p75Psf);

  const nearMedianPsf = toNum(cma.nearHandoverGroup?.medianPsf);
  const nearMedianPrice = toNum(cma.nearHandoverGroup?.medianPriceAed);

  const gapToOffPlan = toNum(cma.gapToOffPlanPercent);
  const gapToReady = toNum(cma.gapToReadyPercent);
  const gapToNear = toNum(cma.gapToNearHandoverPercent);

  // Combined transactions list for DLD feed tab
  const allTransactions = useMemo(() => {
    const list: Array<TransactionFact & { groupTag: "Group A: Ready" | "Group B: Off-Plan" | "Group C: Near" }> = [];
    if (cma.readyGroup?.transactions) {
      cma.readyGroup.transactions.forEach((t) => list.push({ ...t, groupTag: "Group A: Ready" }));
    }
    if (cma.offPlanGroup?.transactions) {
      cma.offPlanGroup.transactions.forEach((t) => list.push({ ...t, groupTag: "Group B: Off-Plan" }));
    }
    if (cma.nearHandoverGroup?.transactions) {
      cma.nearHandoverGroup.transactions.forEach((t) => list.push({ ...t, groupTag: "Group C: Near" }));
    }
    list.sort((a, b) => (b.transactionDate || "").localeCompare(a.transactionDate || ""));
    return list;
  }, [cma]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (txFilter === "ready" && tx.isOffPlan) return false;
      if (txFilter === "offplan" && !tx.isOffPlan) return false;
      if (txFilter === "near" && tx.groupTag !== "Group C: Near") return false;
      if (txSearch) {
        const q = txSearch.toLowerCase();
        const matchesBuilding = (tx.buildingName || "").toLowerCase().includes(q);
        const matchesDate = (tx.transactionDate || "").includes(q);
        return matchesBuilding || matchesDate;
      }
      return true;
    });
  }, [allTransactions, txFilter, txSearch]);

  // Custom Simulator calculations
  const simCustomPrice = customPriceInput ? parseFloat(customPriceInput) : null;
  const simCustomPsf = customPsfInput
    ? parseFloat(customPsfInput)
    : simCustomPrice && targetArea
    ? simCustomPrice / targetArea
    : targetPsf;

  const simGapToOffPlan =
    offPlanMedianPsf && simCustomPsf
      ? Math.round((1 - simCustomPsf / offPlanMedianPsf) * 1000) / 10
      : null;

  const simGapToReady =
    readyMedianPsf && simCustomPsf
      ? Math.round((1 - simCustomPsf / readyMedianPsf) * 1000) / 10
      : null;

  // Scale calculations for horizontal spectrum bar
  const spectrumMin = 900;
  const spectrumMax = 3200;
  const getPercentOnScale = (psf: number) => {
    const clamped = Math.max(spectrumMin, Math.min(spectrumMax, psf));
    return ((clamped - spectrumMin) / (spectrumMax - spectrumMin)) * 100;
  };

  const getReliabilityBadge = (rel: string) => {
    switch (rel) {
      case "ROBUST":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Robust Sample (≥15 deals)
          </span>
        );
      case "WEAK_SAMPLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Moderate Sample (5–14 deals)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 border border-rose-200 text-rose-800">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            Limited Sample (&lt;5 deals)
          </span>
        );
    }
  };

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
      {/* 1. Header & Quick Links */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  Comparable Market Analysis (Phase 3 Live)
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  DLD Verified
                </span>
                {loading && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Recalculating...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time benchmarking against verified DLD sales in{" "}
                <strong className="text-slate-800">{areaName || "Cluster"}</strong> for{" "}
                <strong className="text-sky-700 font-semibold">{bedroomLabel(activeBedroom)} format</strong>
                {expectedHandoverDate ? ` · Target Handover: ${expectedHandoverDate}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/projects/${projectId}/cma`}
            className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold px-3 py-1.5 rounded-xl bg-sky-50/80 hover:bg-sky-100/70 border border-sky-200/60 transition-colors"
          >
            <span>Open Dedicated CMA Page</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Interactive Switcher Bar: Layouts, Time Windows & Pricing Basis */}
      <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Bedroom Layout Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3 text-slate-400" />
            Layout:
          </span>
          {unitTypes.map((u) => {
            const br = u.bedrooms ?? 0;
            const isSelected = activeBedroom === br;
            return (
              <button
                key={u.id || br}
                onClick={() => handleBedClick(br)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70"
                }`}
              >
                <span>{bedroomLabel(br)}</span>
                {u.netPriceAed && (
                  <span
                    className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                      isSelected ? "bg-slate-800 text-sky-200" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {formatAed(u.netPriceAed)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time Window & Price Basis Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {/* Time Window */}
          <div className="flex items-center gap-1 bg-white border border-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <div className="px-1.5 text-slate-400 text-[10px] uppercase font-bold flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              <span>Time:</span>
            </div>
            {[6, 12, 24].map((m) => (
              <button
                key={m}
                onClick={() => handleMonthsChange(m)}
                className={`px-2 py-0.8 rounded-md text-[11px] transition-colors ${
                  monthsWindow === m
                    ? "bg-sky-600 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {m}M
              </button>
            ))}
          </div>

          {/* Pricing Basis Toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => handlePriceBasisChange("net")}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                priceBasis === "net"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Net Promotional Asking Price"
            >
              Net Price
            </button>
            <button
              onClick={() => handlePriceBasisChange("list")}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                priceBasis === "list"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Official Developer List Price"
            >
              List Price
            </button>
            <button
              onClick={() => handlePriceBasisChange("custom")}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors flex items-center gap-1 ${
                priceBasis === "custom"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Custom What-If Price Simulator"
            >
              <Sliders className="h-3 w-3" />
              <span>What-If</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Core 4-Pillar Comparative Matrix (PSF AND Total Ticket Price) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Target Unit (Viewz 1) */}
        <div className="bg-sky-50/50 border-2 border-sky-200/90 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-100/50 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              Target Unit Asking
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-100/80 text-sky-800 text-[10px] font-bold font-mono">
              {cma.targetPriceSource === "list" ? "List Price" : "Net Price"}
            </span>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
              {targetPsf.toFixed(0)}{" "}
              <span className="text-xs font-normal text-slate-500">AED/sqft</span>
            </div>
            <div className="text-xs font-semibold text-sky-900 mt-1 flex items-center justify-between border-t border-sky-100 pt-1.5">
              <span>Total Ticket:</span>
              <strong className="text-slate-900 font-bold font-mono">{formatAed(targetPrice)}</strong>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
              <span>Unit Area:</span>
              <span className="font-mono text-slate-700">{formatArea(targetArea)}</span>
            </div>
          </div>

          <div className="text-[10.5px] text-sky-950 bg-white/80 p-2 rounded-lg border border-sky-200/60 leading-tight">
            Aston Martin Furnished · 65/35 1% Post-Handover Plan
          </div>
        </div>

        {/* Card 2: Group B: Off-Plan Cluster Peers (CRITICAL BENCHMARK) */}
        <div className="bg-emerald-50/40 border border-emerald-200/90 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-emerald-800 uppercase tracking-wider text-[11px]">
              Group B: Off-Plan Peers
            </span>
            <span className="text-slate-500 text-[10px] font-mono">
              {cma.offPlanGroup?.count ?? 0} deals · {cma.offPlanGroup?.distinctBuildings ?? 0} projects
            </span>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
              {offPlanMedianPsf ? Math.round(offPlanMedianPsf).toLocaleString() : "—"}{" "}
              <span className="text-xs font-normal text-slate-500">AED/sqft</span>
            </div>
            <div className="text-xs font-semibold text-emerald-900 mt-1 flex items-center justify-between border-t border-emerald-100 pt-1.5">
              <span>Median Ticket:</span>
              <strong className="text-slate-900 font-bold font-mono">{formatAed(offPlanMedianPrice)}</strong>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
              <span>Peer IQR Range:</span>
              <span className="font-mono text-slate-700">
                {offPlanP25Psf ? Math.round(offPlanP25Psf) : "—"} – {offPlanP75Psf ? Math.round(offPlanP75Psf) : "—"}
              </span>
            </div>
          </div>

          {/* Off-Plan Position Highlight */}
          <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-300/70 text-[11px] leading-tight">
            {gapToOffPlan !== null ? (
              gapToOffPlan > 0 ? (
                <div className="font-bold text-emerald-900 flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span>-{gapToOffPlan.toFixed(1)}% Below Peer Median</span>
                </div>
              ) : (
                <div className="font-bold text-amber-900 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  <span>+{Math.abs(gapToOffPlan).toFixed(1)}% Above Peer Median</span>
                </div>
              )
            ) : (
              <span className="text-slate-500">Sample insufficient</span>
            )}
            <p className="text-[10px] text-emerald-800 font-normal mt-0.5">
              {gapToOffPlan && gapToOffPlan > 0
                ? "Competitive entry below cluster off-plan pipeline"
                : "Premium positioning vs off-plan launches"}
            </p>
          </div>
        </div>

        {/* Card 3: Group A: Ready Secondary Sales (Mature Stock) */}
        <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
              Group A: Ready Sales
            </span>
            <span className="text-slate-500 text-[10px] font-mono">
              {cma.readyGroup?.count ?? 0} deals · {cma.readyGroup?.distinctBuildings ?? 0} towers
            </span>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
              {readyMedianPsf ? Math.round(readyMedianPsf).toLocaleString() : "—"}{" "}
              <span className="text-xs font-normal text-slate-500">AED/sqft</span>
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-1 flex items-center justify-between border-t border-slate-200/80 pt-1.5">
              <span>Median Ticket:</span>
              <strong className="text-slate-900 font-bold font-mono">{formatAed(readyMedianPrice)}</strong>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
              <span>Ready IQR Range:</span>
              <span className="font-mono text-slate-700">
                {readyP25Psf ? Math.round(readyP25Psf) : "—"} – {readyP75Psf ? Math.round(readyP75Psf) : "—"}
              </span>
            </div>
          </div>

          {/* Ready Gap Highlight */}
          <div className="p-2 rounded-lg bg-slate-100/90 border border-slate-200 text-[11px] leading-tight">
            {gapToReady !== null ? (
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>
                  {gapToReady > 0 ? `-${gapToReady.toFixed(1)}%` : `+${Math.abs(gapToReady).toFixed(1)}%`}{" "}
                  Spread to 2008 Stock
                </span>
              </div>
            ) : (
              <span className="text-slate-500">Sample insufficient</span>
            )}
            <p className="text-[10px] text-slate-500 font-normal mt-0.5">
              New-build premium over 15–20 yr older legacy towers
            </p>
          </div>
        </div>

        {/* Card 4: Group C: Near-Handover / Mature Off-Plan */}
        <div className="bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-indigo-800 uppercase tracking-wider text-[11px]">
              Group C: Near-Handover
            </span>
            <span className="text-slate-500 text-[10px] font-mono">
              {cma.nearHandoverGroup?.count ?? 0} deals · {cma.nearHandoverGroup?.distinctBuildings ?? 0} bldgs
            </span>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
              {nearMedianPsf ? Math.round(nearMedianPsf).toLocaleString() : "—"}{" "}
              <span className="text-xs font-normal text-slate-500">AED/sqft</span>
            </div>
            <div className="text-xs font-semibold text-indigo-900 mt-1 flex items-center justify-between border-t border-indigo-100 pt-1.5">
              <span>Median Ticket:</span>
              <strong className="text-slate-900 font-bold font-mono">{formatAed(nearMedianPrice)}</strong>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
              <span>Delivery Window:</span>
              <span className="font-mono text-indigo-900 font-semibold">2024–2026 Peers</span>
            </div>
          </div>

          {/* Near-Handover Benchmark */}
          <div className="p-2 rounded-lg bg-indigo-100/70 border border-indigo-200/80 text-[11px] leading-tight">
            {gapToNear !== null ? (
              <div className="font-bold text-indigo-900 flex items-center gap-1">
                <span>
                  {gapToNear > 0 ? `-${gapToNear.toFixed(1)}%` : `+${Math.abs(gapToNear).toFixed(1)}%`}{" "}
                  vs Handover Level
                </span>
              </div>
            ) : (
              <span className="text-indigo-900 font-semibold">Milestone Benchmark</span>
            )}
            <p className="text-[10px] text-indigo-800 font-normal mt-0.5">
              Delivering peer benchmark (Ellington UH, MBL Royal)
            </p>
          </div>
        </div>
      </div>

      {/* 4. Visual Price Spectrum Bar */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-sky-600" />
              Market Price Spectrum (AED / Sq.Ft.)
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Distribution of real DLD sales in {areaName} relative to Target Unit Asking PSF
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Ready Median
            </span>
            <span className="flex items-center gap-1 text-indigo-700">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Near-Handover
            </span>
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Off-Plan Median
            </span>
            <span className="flex items-center gap-1 text-sky-700 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 inline-block" /> Target Unit
            </span>
          </div>
        </div>

        {/* Visual Bar Container */}
        <div className="relative pt-6 pb-4">
          {/* Base Axis Track */}
          <div className="h-4 w-full bg-slate-200/80 rounded-full relative overflow-hidden">
            {/* Ready Range Band */}
            {readyP25Psf && readyP75Psf && (
              <div
                className="absolute top-0 bottom-0 bg-slate-300/80 border-x border-slate-400/50"
                style={{
                  left: `${getPercentOnScale(readyP25Psf)}%`,
                  width: `${Math.max(2, getPercentOnScale(readyP75Psf) - getPercentOnScale(readyP25Psf))}%`,
                }}
                title={`Ready IQR: ${Math.round(readyP25Psf)} - ${Math.round(readyP75Psf)} AED/sqft`}
              />
            )}

            {/* Off-Plan Range Band */}
            {offPlanP25Psf && offPlanP75Psf && (
              <div
                className="absolute top-0 bottom-0 bg-emerald-200/80 border-x border-emerald-400/50"
                style={{
                  left: `${getPercentOnScale(offPlanP25Psf)}%`,
                  width: `${Math.max(2, getPercentOnScale(offPlanP75Psf) - getPercentOnScale(offPlanP25Psf))}%`,
                }}
                title={`Off-Plan IQR: ${Math.round(offPlanP25Psf)} - ${Math.round(offPlanP75Psf)} AED/sqft`}
              />
            )}
          </div>

          {/* Ready Median Pin */}
          {readyMedianPsf && (
            <div
              className="absolute top-3.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${getPercentOnScale(readyMedianPsf)}%` }}
            >
              <div className="w-2.5 h-7 bg-slate-600 rounded-full shadow-xs" />
              <span className="text-[10px] font-mono font-bold text-slate-700 mt-1 whitespace-nowrap">
                {Math.round(readyMedianPsf)}
              </span>
            </div>
          )}

          {/* Near Handover Median Pin */}
          {nearMedianPsf && (
            <div
              className="absolute top-3.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${getPercentOnScale(nearMedianPsf)}%` }}
            >
              <div className="w-2.5 h-7 bg-indigo-600 rounded-full shadow-xs" />
              <span className="text-[10px] font-mono font-bold text-indigo-800 mt-1 whitespace-nowrap">
                {Math.round(nearMedianPsf)}
              </span>
            </div>
          )}

          {/* Off-Plan Median Pin */}
          {offPlanMedianPsf && (
            <div
              className="absolute top-3.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${getPercentOnScale(offPlanMedianPsf)}%` }}
            >
              <div className="w-2.5 h-7 bg-emerald-600 rounded-full shadow-xs" />
              <span className="text-[10px] font-mono font-bold text-emerald-800 mt-1 whitespace-nowrap">
                {Math.round(offPlanMedianPsf)}
              </span>
            </div>
          )}

          {/* Target Unit Marker (Pulsing Pin with Badge) */}
          <div
            className="absolute -top-1 -translate-x-1/2 flex flex-col items-center z-10"
            style={{ left: `${getPercentOnScale(targetPsf)}%` }}
          >
            <div className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-extrabold shadow-sm flex items-center gap-1 whitespace-nowrap">
              <span>★ Target: {Math.round(targetPsf)} AED</span>
            </div>
            <div className="w-3.5 h-3.5 bg-sky-600 rounded-full border-2 border-white shadow-md ring-2 ring-sky-300 animate-pulse mt-0.5" />
          </div>
        </div>

        {/* Spectrum Scale Labels */}
        <div className="flex justify-between text-[10px] text-slate-600 font-mono pt-2 border-t border-slate-200">
          <span>{spectrumMin} AED/sqft (Affordable Older Stock)</span>
          <span>1,800 AED</span>
          <span>2,400 AED</span>
          <span>{spectrumMax}+ AED/sqft (Luxury High-End)</span>
        </div>
      </div>

      {/* 5. Deep-Dive Tabs (Valuation Insights, Towers Breakdown, Verified Transactions Feed, What-If Simulator) */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2 px-3 border-b-2 font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <span>Investment Verdict & Takeaways</span>
          </button>

          <button
            onClick={() => setActiveTab("towers")}
            className={`pb-2 px-3 border-b-2 font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === "towers"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Comparable Projects & Towers ({(cma.offPlanGroup?.distinctBuildings ?? 0) + (cma.readyGroup?.distinctBuildings ?? 0)})</span>
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={`pb-2 px-3 border-b-2 font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === "transactions"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Verified DLD Deals Feed ({allTransactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`pb-2 px-3 border-b-2 font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === "simulator"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>What-If Price Sensitivity</span>
          </button>
        </div>

        {/* Tab 1: Valuation Insights & Synthesis */}
        {activeTab === "overview" && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Insight 1: Off-Plan Entry Advantage */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>1. Off-Plan Peer Advantage</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Target unit asks <strong className="text-slate-900">{formatPsf(targetPsf)}</strong> vs cluster off-plan median of{" "}
                  <strong className="text-slate-900">{formatPsf(offPlanMedianPsf)}</strong>.
                  {gapToOffPlan && gapToOffPlan > 0 ? (
                    <span>
                      {" "}You are entering at a <strong className="text-emerald-700 font-bold">{gapToOffPlan.toFixed(1)}% discount</strong> compared to neighboring developments launched in the same cycle.
                    </span>
                  ) : (
                    <span>
                      {" "}Positioned at a slight premium justified by Aston Martin designer furnishing and high-floor specifications.
                    </span>
                  )}
                </p>
              </div>

              {/* Insight 2: Total Ticket vs PSF Dissection */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                  <DollarSign className="h-4 w-4 text-sky-600" />
                  <span>2. Capital Ticket Reality</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Secondary ready 1BRs in JLT average <strong className="text-slate-900">~850–950 sqft</strong> at {formatPsf(readyMedianPsf)} (Total: {formatAed(readyMedianPrice)}).
                  Modern off-plan optimizes layout to <strong className="text-slate-900">{formatArea(targetArea)}</strong> at {formatPsf(targetPsf)} (Total: {formatAed(targetPrice)}).
                  The absolute capital required to enter is only separated by <strong className="text-slate-900">~AED {Math.round(Math.abs((targetPrice || 0) - (readyMedianPrice || 0)) / 1000)}k</strong>.
                </p>
              </div>

              {/* Insight 3: Near-Handover Upside */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  <span>3. Delivery Convergence</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Peer projects handing over in 2024–2026 (Ellington UH, ME DO RE, MBL Royal) are currently trading at{" "}
                  <strong className="text-indigo-900 font-bold">{formatPsf(nearMedianPsf)}</strong> ({formatAed(nearMedianPrice)} median ticket).
                  Provides pricing benchmark as the tower progresses towards key completion milestones.
                </p>
              </div>
            </div>

            {/* Editorial Rule-based Conclusion */}
            <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 flex items-start gap-3 text-xs text-sky-950">
              <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-900 font-bold">Methodological Synthesis (§7): </strong>
                {cma.editorialConclusion}
                <div className="text-slate-500 mt-1">
                  Sample gates: {getReliabilityBadge(cma.readyGroup?.reliability || "INSUFFICIENT")}. Excludes construction risk, floor premium, and post-handover payment plan carrying value.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Comparable Towers & Projects Tables */}
        {activeTab === "towers" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
            {/* Off-Plan Projects Table */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Off-Plan Peer Developments ({cma.offPlanGroup?.buildingBreakdown?.length || 0})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">DLD Oqood Deals</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-bold">Project / Tower</th>
                      <th className="py-2 px-2 text-center font-bold">Deals</th>
                      <th className="py-2 px-2 text-center font-bold">Share</th>
                      <th className="py-2 px-2.5 text-right font-bold">Median PSF</th>
                      <th className="py-2 px-2.5 text-right font-bold">Median Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cma.offPlanGroup?.buildingBreakdown?.slice(0, 8).map((b, i) => (
                      <tr key={i} className="hover:bg-white/80 transition-colors">
                        <td className="py-2 px-2.5 font-sans font-semibold text-slate-900 truncate max-w-[140px]" title={b.buildingName}>
                          {b.buildingName}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600">{b.count}</td>
                        <td className="py-2 px-2 text-center text-slate-500 text-[11px]">{b.sharePct}%</td>
                        <td className="py-2 px-2.5 text-right font-bold text-emerald-700">
                          {b.medianPsf ? `${Math.round(toNum(b.medianPsf) || 0).toLocaleString()} AED` : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-700 text-[11px]">
                          {formatAed(toNum(b.medianPriceAed))}
                        </td>
                      </tr>
                    ))}
                    {(!cma.offPlanGroup?.buildingBreakdown || cma.offPlanGroup.buildingBreakdown.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500 font-sans">
                          No off-plan registered sales recorded for this format.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ready Secondary Towers Table */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  Ready Secondary Towers ({cma.readyGroup?.buildingBreakdown?.length || 0})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">DLD Title Deeds</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-bold">Tower Name</th>
                      <th className="py-2 px-2 text-center font-bold">Deals</th>
                      <th className="py-2 px-2 text-center font-bold">Share</th>
                      <th className="py-2 px-2.5 text-right font-bold">Median PSF</th>
                      <th className="py-2 px-2.5 text-right font-bold">Median Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cma.readyGroup?.buildingBreakdown?.slice(0, 8).map((b, i) => (
                      <tr key={i} className="hover:bg-white/80 transition-colors">
                        <td className="py-2 px-2.5 font-sans font-semibold text-slate-900 truncate max-w-[140px]" title={b.buildingName}>
                          {b.buildingName}
                          {b.sharePct >= 70 && (
                            <span className="ml-1 text-[9px] font-sans font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                              Dominant
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600">{b.count}</td>
                        <td className="py-2 px-2 text-center text-slate-500 text-[11px]">{b.sharePct}%</td>
                        <td className="py-2 px-2.5 text-right font-bold text-slate-800">
                          {b.medianPsf ? `${Math.round(toNum(b.medianPsf) || 0).toLocaleString()} AED` : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-700 text-[11px]">
                          {formatAed(toNum(b.medianPriceAed))}
                        </td>
                      </tr>
                    ))}
                    {(!cma.readyGroup?.buildingBreakdown || cma.readyGroup.buildingBreakdown.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500 font-sans">
                          No ready sales recorded in this cluster.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Verified DLD Deals Feed */}
        {activeTab === "transactions" && (
          <div className="space-y-3 pt-1">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <button
                  onClick={() => setTxFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    txFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Deals ({allTransactions.length})
                </button>
                <button
                  onClick={() => setTxFilter("offplan")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    txFilter === "offplan"
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Off-Plan Only ({cma.offPlanGroup?.transactions?.length || 0})
                </button>
                <button
                  onClick={() => setTxFilter("ready")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    txFilter === "ready"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Ready Secondary ({cma.readyGroup?.transactions?.length || 0})
                </button>
                <button
                  onClick={() => setTxFilter("near")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    txFilter === "near"
                      ? "bg-indigo-700 text-white"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  Near-Handover ({cma.nearHandoverGroup?.transactions?.length || 0})
                </button>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search building or date..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-full sm:w-48"
                />
              </div>
            </div>

            {/* Deals Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Building / Project</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Area (sqft)</th>
                      <th className="py-2.5 px-3 text-right">Sale Price</th>
                      <th className="py-2.5 px-3 text-right">Price PSF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredTransactions.slice(0, txPageSize).map((tx, idx) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                          {tx.transactionDate}
                        </td>
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900 truncate max-w-[200px]" title={tx.buildingName}>
                          {tx.buildingName || "—"}
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          {tx.isOffPlan ? (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              Off-Plan Oqood
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                              Ready Title Deed
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          {formatArea(tx.areaSqft)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatAed(tx.salePriceAED)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-sky-700">
                          {formatPsf(tx.pricePerSqftAED)}
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                          No transactions matching current filter or search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length > txPageSize && (
                <div className="bg-slate-50/80 p-2.5 border-t border-slate-200 text-center">
                  <button
                    onClick={() => setTxPageSize((prev) => prev + 15)}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    Load 15 More Transactions (Showing {txPageSize} of {filteredTransactions.length}) &darr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: What-If Price Sensitivity Simulator */}
        {activeTab === "simulator" && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-5 space-y-4 pt-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-sky-600" />
                What-If Price & Acquisition Simulator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Test alternative asking prices or negotiated purchase prices to immediately observe discount/premium gaps against market benchmarks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inputs */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Simulate Target Total Price (AED):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder={`e.g. ${targetPrice}`}
                      value={customPriceInput}
                      onChange={(e) => {
                        setCustomPriceInput(e.target.value);
                        if (e.target.value && targetArea) {
                          setCustomPsfInput(Math.round(parseFloat(e.target.value) / targetArea).toString());
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Simulate Asking PSF (AED / sqft):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder={`e.g. ${Math.round(targetPsf)}`}
                      value={customPsfInput}
                      onChange={(e) => {
                        setCustomPsfInput(e.target.value);
                        if (e.target.value && targetArea) {
                          setCustomPriceInput(Math.round(parseFloat(e.target.value) * targetArea).toString());
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (simCustomPrice && targetArea) {
                        fetchCma(activeBedroom, monthsWindow, simCustomPrice, targetArea);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors shadow-2xs"
                  >
                    Apply to Active Analysis
                  </button>
                  <button
                    onClick={() => {
                      setCustomPriceInput("");
                      setCustomPsfInput("");
                      setPriceBasis("net");
                      fetchCma(activeBedroom, monthsWindow);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>

              {/* Real-Time Sensitivity Feedback */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Simulated Market Benchmark Response
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      vs Off-Plan Median ({formatPsf(offPlanMedianPsf)})
                    </span>
                    <div className="text-xl font-black text-emerald-900 mt-1 tabular-nums">
                      {simGapToOffPlan !== null ? (
                        simGapToOffPlan > 0 ? (
                          <span>-{simGapToOffPlan.toFixed(1)}% Discount</span>
                        ) : (
                          <span>+{Math.abs(simGapToOffPlan).toFixed(1)}% Premium</span>
                        )
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">
                      vs Ready Median ({formatPsf(readyMedianPsf)})
                    </span>
                    <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                      {simGapToReady !== null ? (
                        simGapToReady > 0 ? (
                          <span>-{simGapToReady.toFixed(1)}% Spread</span>
                        ) : (
                          <span>+{Math.abs(simGapToReady).toFixed(1)}% Premium</span>
                        )
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  At <strong className="text-slate-800 font-mono">{formatPsf(simCustomPsf)}</strong>, total acquisition capital is{" "}
                  <strong className="text-slate-800 font-mono">{formatAed(simCustomPrice || (simCustomPsf * targetArea))}</strong> for a{" "}
                  <strong className="text-slate-800">{formatArea(targetArea)}</strong> layout.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
