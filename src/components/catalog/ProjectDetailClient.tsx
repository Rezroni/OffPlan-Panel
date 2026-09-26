"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  MapPin,
  ArrowLeft,
  ChevronRight,
  Info,
  BadgeCheck,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Video,
  FileText,
  Landmark,
} from "lucide-react";
import type { ProjectDetail } from "@/server/dal/catalog";
import type { CMAResult } from "@/domain/cma/comparable-set";
import type { CompetingSupplyAnalysis } from "@/domain/pipeline/competing-supply";
import { FundingExitSimulator } from "@/components/funding/FundingExitSimulator";
import { Header } from "@/components/desk/Header";
import { CompetingSupplyPanel } from "@/components/pipeline/CompetingSupplyPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UnitType = {
  id: string;
  bedrooms: number | null;
  unitTypeLabel: string | null;
  areaSqftMin: number | null;
  areaSqftMax: number | null;
  areaType: string | null;
  listPriceAed: number | null;
  netPriceAed: number | null;
  priceSource: string | null;
  priceAsOf: string | null;
  assignmentPolicy: string | null;
  minPaidPctForNoc: number | null;
};

type Props = {
  project: ProjectDetail;
  unitTypes: UnitType[];
  initialCma: CMAResult;
  pipelineAnalysis?: CompetingSupplyAnalysis | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatAed = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `AED ${m.toFixed(2)}M`;
  }
  if (v >= 1_000) {
    return `AED ${Math.round(v / 1_000)}k`;
  }
  return `AED ${Math.round(v).toLocaleString("en-US")}`;
};

const formatFullAed = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  return `AED ${Math.round(v).toLocaleString("en-US")}`;
};

const formatSqft = (min: number | null, max: number | null) => {
  if (min === null && max === null) return "—";
  if (min === null) return `${max?.toFixed(0)} sqft`;
  if (max === null || min === max) return `${min?.toFixed(0)} sqft`;
  return `${min?.toFixed(0)}–${max?.toFixed(0)} sqft`;
};

const bedroomLabel = (br: number | null) => {
  if (br === null) return "Unknown";
  if (br === 0) return "Studio";
  return `${br}BR`;
};

// ---------------------------------------------------------------------------
// Escrow Status
// ---------------------------------------------------------------------------

function EscrowBadge({ status, bankName }: { status: string | null; bankName: string | null }) {
  const isVerified = status === "verified_active";
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
      isVerified
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-slate-100 border-slate-200 text-slate-600"
    }`}>
      {isVerified ? <Shield className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-slate-400" />}
      <span>
        Escrow:{" "}
        <strong className="font-semibold text-slate-900">{isVerified ? "Verified Active" : status ?? "Unknown"}</strong>
        {bankName ? ` · ${bankName}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignment Policy Badge
// ---------------------------------------------------------------------------

function AssignmentBadge({ policy }: { policy: string | null }) {
  const configs: Record<string, { color: string; label: string }> = {
    allowed: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "✓ Assignment Allowed" },
    prohibited: { color: "text-rose-700 bg-rose-50 border-rose-200", label: "✗ Assignment Prohibited" },
    conditional: { color: "text-amber-800 bg-amber-50 border-amber-200", label: "⚠ Conditional Assignment" },
    unknown: { color: "text-slate-600 bg-slate-100 border-slate-200", label: "? Assignment Unknown" },
  };
  const cfg = configs[policy ?? "unknown"] ?? configs.unknown;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Construction & Handover
// ---------------------------------------------------------------------------

function ConstructionSection({ project }: { project: ProjectDetail }) {
  const progress = project.constructionProgressPct;
  const handover = project.expectedHandoverDate;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sky-600" />
        Construction &amp; Handover
      </h2>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Construction Progress</span>
          <span className="text-slate-900 font-bold font-mono">
            {progress !== null ? `${progress.toFixed(0)}%` : "Unknown"}
          </span>
        </div>
        <div className="bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
          <div
            className="bg-sky-600 h-2 rounded-full transition-all"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <Calendar className="h-4 w-4 text-slate-400" />
        <span>
          Expected Handover:{" "}
          <strong className="text-slate-900 font-semibold">
            {handover ? new Date(handover).toLocaleDateString("en-AE", { month: "short", year: "numeric" }) : "Not specified"}
          </strong>{" "}
          <span className="text-slate-400 text-[11px]">({project.handoverDateSource ? `source: ${project.handoverDateSource}` : "source: dld"})</span>
        </span>
      </div>

      <div className="flex items-start gap-2 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3 py-2 text-xs text-amber-900 shadow-2xs">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
        <span>
          Expected handover date from DLD is the <em>current expected date</em>, not the original
          developer promise. Actual handover confirmation requires separate verification.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Project Detail Component
// ---------------------------------------------------------------------------

export default function ProjectDetailClient({
  project,
  unitTypes: initialUnits,
  initialCma,
  pipelineAnalysis,
}: Props) {
  const [units, setUnits] = useState<UnitType[]>(initialUnits);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    initialUnits[0]?.id || ""
  );
  const [cma, setCma] = useState<CMAResult>(initialCma);
  const [cmaLoading, setCmaLoading] = useState(false);
  const [syncingUnits, setSyncingUnits] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [generatingDossier, setGeneratingDossier] = useState(false);

  // Active selected unit
  const activeUnit = units.find((u) => u.id === selectedUnitId) || units[0];

  const handleGenerateDossier = async () => {
    try {
      setGeneratingDossier(true);
      const res = await fetch("/api/reports/create-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          unitTypeId: selectedUnitId,
          locale: "ru",
        }),
      });
      const data = await res.json();
      if (data.success && data.snapshotId) {
        window.open(`/reports/${data.snapshotId}`, "_blank");
      }
    } catch (e) {
      console.error("Generate dossier failed:", e);
    } finally {
      setGeneratingDossier(false);
    }
  };

  // Handle selecting a unit type -> immediately recalculate CMA
  const handleSelectUnit = async (unit: UnitType) => {
    setSelectedUnitId(unit.id);
    const br = unit.bedrooms ?? 1;
    setCmaLoading(true);
    try {
      const res = await fetch(`/api/cma/${project.id}?bedrooms=${br}`);
      if (res.ok) {
        const json = await res.json();
        setCma(json.cma);
      }
    } catch (err) {
      console.error("Failed to update CMA:", err);
    } finally {
      setCmaLoading(false);
    }
  };

  // Sync real units live from DLD
  const handleSyncUnits = async () => {
    setSyncingUnits(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/sync-units`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.unitTypes && data.unitTypes.length > 0) {
        setUnits(data.unitTypes);
        setSelectedUnitId(data.unitTypes[0].id);
        setSyncMessage(`Successfully downloaded ${data.unitTypes.length} real unit types from DLD!`);
        // Recalculate CMA for the first unit
        handleSelectUnit(data.unitTypes[0]);
      } else {
        setSyncMessage("No additional units registered in DLD for this project ID.");
      }
    } catch (err) {
      setSyncMessage("Error connecting to DLD Units API.");
    } finally {
      setSyncingUnits(false);
    }
  };

  const getReliabilityBadge = (rel: string) => {
    switch (rel) {
      case "ROBUST":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Robust Sample (≥15 sales, ≥3 towers)
          </span>
        );
      case "WEAK_SAMPLE":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Weak Sample (5–14 sales)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Insufficient Sample (&lt;5 sales)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500/20 selection:text-sky-900">
      {/* Global Unified Navigation Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Breadcrumb & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Catalog</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-800 font-semibold truncate max-w-sm">{project.nameEn}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              <Video className="h-3.5 w-3.5 text-sky-600" />
              <span className="hidden sm:inline">Reels Studio</span>
            </Link>

            <button
              type="button"
              onClick={handleGenerateDossier}
              disabled={generatingDossier}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{generatingDossier ? "Generating..." : "Generate Client PDF Dossier"}</span>
            </button>
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 tracking-tight">{project.nameEn}</h1>
              {project.nameAr && (
                <p className="text-base text-slate-500 font-medium" dir="rtl">{project.nameAr}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                project.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : project.status === "completed"
                  ? "bg-sky-50 text-sky-700 border-sky-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {project.status ?? "Status Unknown"}
              </span>
            </div>
          </div>

          {/* Identity row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* 1. Operating / Project Developer */}
            {(project.operatingDeveloperName || project.developerBrandName) && (
              project.developerId ? (
                <Link
                  href={`/developers/${project.developerId}`}
                  className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 rounded-xl px-3 py-1.5 transition-colors group shadow-2xs"
                  title="Operating Developer responsible for concept, architecture & delivery"
                >
                  <Building2 className="h-3.5 w-3.5 text-sky-600 group-hover:text-sky-700" />
                  <span className="text-slate-500 text-[11px]">Developer:</span>
                  <span className="text-slate-900 font-semibold group-hover:text-sky-700">
                    {project.operatingDeveloperName || project.developerBrandName}
                  </span>
                  <span className="text-[10px] text-sky-600 font-mono ml-1 group-hover:translate-x-0.5 transition-transform">
                    Track Record &rarr;
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-500 text-[11px]">Developer:</span>
                  <span className="text-slate-800 font-semibold">{project.operatingDeveloperName || project.developerBrandName}</span>
                </div>
              )
            )}

            {/* 2. Master Developer / Landowner (DLD Registered Entity) */}
            {project.masterDeveloperName && (
              <div 
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-amber-900 shadow-2xs"
                title="Master Community Developer & Landowner registered in Dubai Land Department"
              >
                <Landmark className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-700 text-[11px]">Master / Land:</span>
                <span className="text-amber-900 font-semibold">{project.masterDeveloperName}</span>
              </div>
            )}
            {project.areaNameEn && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-slate-800 font-medium">{project.areaNameEn}</span>
              </div>
            )}
            {project.dldProjectId && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700">
                <BadgeCheck className="h-3.5 w-3.5 text-sky-600" />
                <span className="text-slate-500">DLD ID:</span>
                <span className="text-slate-800 font-mono font-semibold">{project.dldProjectId}</span>
              </div>
            )}
          </div>

          {/* Escrow */}
          <EscrowBadge status={project.escrowStatus} bankName={project.escrowBankName} />
        </div>

        {/* Construction Section */}
        <ConstructionSection project={project} />

        {/* Interactive Unit Types Section */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-600" />
                Unit Line-up &amp; Specification ({units.length} Types)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any unit type below to select it and update the real-time CMA analysis.
              </p>
            </div>

            {/* Sync button */}
            <button
              onClick={handleSyncUnits}
              disabled={syncingUnits}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingUnits ? "animate-spin text-sky-600" : ""}`} />
              {syncingUnits ? "Syncing from DLD..." : "Download Full Line-up from DLD"}
            </button>
          </div>

          {syncMessage && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-xs text-sky-800">
              {syncMessage}
            </div>
          )}

          {/* Interactive Unit Types Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {units.map((ut) => {
              const isSelected = ut.id === selectedUnitId;
              return (
                <button
                  type="button"
                  key={ut.id}
                  onClick={() => handleSelectUnit(ut)}
                  className={`text-left border rounded-2xl p-4 transition-all duration-150 cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "border-sky-600 bg-sky-50/50 ring-2 ring-sky-500/20 shadow-sm"
                      : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs"
                  }`}
                >
                  {/* Top line */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">
                          {bedroomLabel(ut.bedrooms)}
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-sky-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Selected for CMA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {ut.unitTypeLabel ?? `${bedroomLabel(ut.bedrooms)} Apartment`}
                      </p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Size</span>
                      <span className="text-slate-800 font-semibold font-mono">
                        {formatSqft(ut.areaSqftMin, ut.areaSqftMax)}
                      </span>
                    </div>
                    <div title={formatFullAed(ut.netPriceAed)}>
                      <span className="text-slate-500 text-[11px] block">
                        {ut.priceSource === "dld_oqood_verified"
                          ? "First Oqood Deal Price"
                          : ut.priceSource === "developer_offer"
                          ? "Developer List Price"
                          : "Estimated Net Price"}
                      </span>
                      <span className="text-emerald-700 font-bold font-mono cursor-help">
                        {formatAed(ut.netPriceAed)}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
                    <AssignmentBadge policy={ut.assignmentPolicy} />
                    {ut.priceSource === "dld_oqood_verified" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Oqood Verified
                      </span>
                    ) : ut.priceSource === "area_oqood_comps" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                        Area Oqood Comps
                      </span>
                    ) : ut.priceSource === "developer_offer" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Developer Inventory
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">
                        {ut.priceSource || "synthetic_estimate"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* LIVE EMBEDDED CMA 3-GROUP ANALYSIS (Phase 3 Engine) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sky-600" />
                <h2 className="font-bold text-slate-900 text-base">
                  Comparable Market Analysis (Phase 3 Live)
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time analysis against 484k+ verified DLD transactions for format:{" "}
                <strong className="text-sky-700 font-semibold">{bedroomLabel(activeUnit?.bedrooms ?? 1)}</strong> in{" "}
                <strong className="text-slate-800">{project.areaNameEn || "Cluster"}</strong>
              </p>
            </div>

            <Link
              href={`/projects/${project.id}/cma`}
              className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold hover:underline shrink-0"
            >
              Open Dedicated CMA Page &rarr;
            </Link>
          </div>

          {cmaLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-sky-700 text-xs">
              <RefreshCw className="h-5 w-5 animate-spin text-sky-600" />
              Recalculating CMA 3-group comparables for selected unit...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Primary Gap Banner */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Target Unit Asking PSF
                  </span>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                    {Number(cma.targetPsf).toFixed(0)}{" "}
                    <span className="text-xs font-normal text-slate-500">AED/sq.ft.</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                      Gap to Ready Median
                    </span>
                    <div className="mt-0.5">
                      {cma.gapToReadyPercent !== null ? (
                        Number(cma.gapToReadyPercent) > 0 ? (
                          <span className="text-xl font-bold text-emerald-600 flex items-center tabular-nums">
                            <TrendingDown className="h-4 w-4 mr-1" />
                            -{Number(cma.gapToReadyPercent).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xl font-bold text-rose-600 flex items-center tabular-nums">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            +{Math.abs(Number(cma.gapToReadyPercent)).toFixed(1)}%
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">Insufficient Sample</span>
                      )}
                    </div>
                  </div>

                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                      Sample Gate Status
                    </span>
                    <div className="mt-1">
                      {getReliabilityBadge(cma.readyGroup.reliability)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Comparable Groups */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Group A */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-700">Group A: Ready Sales</span>
                    <span className="text-slate-500 font-mono">{cma.readyGroup.count} sales</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 tabular-nums">
                    {cma.readyGroup.medianPsf ? `${Number(cma.readyGroup.medianPsf).toFixed(0)} AED` : "—"}
                    <span className="text-[11px] font-normal text-slate-500 ml-1">psf median</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Distinct towers: <strong className="text-slate-900">{cma.readyGroup.distinctBuildings}</strong>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {cma.readyGroup.reliabilityNote}
                  </p>
                </div>

                {/* Group B */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-sky-700">Group B: Off-Plan Comps</span>
                    <span className="text-slate-500 font-mono">{cma.offPlanGroup.count} sales</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 tabular-nums">
                    {cma.offPlanGroup.medianPsf ? `${Number(cma.offPlanGroup.medianPsf).toFixed(0)} AED` : "—"}
                    <span className="text-[11px] font-normal text-slate-500 ml-1">psf median</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Gap: <strong className="text-slate-900">{cma.gapToOffPlanPercent !== null ? `${Number(cma.gapToOffPlanPercent).toFixed(1)}%` : "—"}</strong>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {cma.offPlanGroup.reliabilityNote}
                  </p>
                </div>

                {/* Group C */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-indigo-700">Group C: Near-Handover</span>
                    <span className="text-slate-500 font-mono">{cma.nearHandoverGroup.count} sales</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 tabular-nums">
                    {cma.nearHandoverGroup.medianPsf ? `${Number(cma.nearHandoverGroup.medianPsf).toFixed(0)} AED` : "—"}
                    <span className="text-[11px] font-normal text-slate-500 ml-1">psf median</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Status: <strong className="text-indigo-800">{cma.nearHandoverGroup.reliability}</strong>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Benchmark for units closer to key handover milestone.
                  </p>
                </div>
              </div>

              {/* Editorial Synthesis */}
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-sky-950">
                <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sky-900">Methodological Synthesis (§7): </strong>
                  {cma.editorialConclusion}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phase 4: Funding & Exit Scenario Engine (§9, §11, §12) */}
        <FundingExitSimulator
          key={activeUnit?.id || "default"}
          initialPrice={activeUnit?.netPriceAed || activeUnit?.listPriceAed || 2000000}
          initialAreaSqft={activeUnit?.areaSqftMin || activeUnit?.areaSqftMax || 850}
          projectName={project.nameEn}
          unitLabel={activeUnit?.unitTypeLabel || (activeUnit?.bedrooms !== null ? `${bedroomLabel(activeUnit?.bedrooms)} Apartment` : "Apartment")}
          handoverDate={project.expectedHandoverDate || "2028-12-01"}
          assignmentPolicy={(activeUnit?.assignmentPolicy as any) || "allowed"}
          minPaidPctForNoc={activeUnit?.minPaidPctForNoc || 34}
        />

        {/* Phase 5: Competing Supply & Cluster Pipeline (§14) */}
        {pipelineAnalysis && (
          <CompetingSupplyPanel
            analysis={pipelineAnalysis}
            projectName={project.nameEn}
          />
        )}

        {/* Metadata footer */}
        <div className="text-xs text-slate-500 pt-3 border-t border-slate-200 flex justify-between font-mono">
          <span>
            First seen: {new Date(project.firstSeenAt).toLocaleDateString("en-AE")} · Updated: {new Date(project.updatedAt).toLocaleDateString("en-AE")}
          </span>
          <span>DLD Pipeline Verified · SQLite Catalog</span>
        </div>
      </main>
    </div>
  );
}
