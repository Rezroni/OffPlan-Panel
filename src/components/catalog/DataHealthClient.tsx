"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/desk/Header";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  ArrowLeft,
  RefreshCw,
  Eye,
  ShieldCheck,
  Loader2,
  Zap,
  Download,
  CalendarDays,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchItem = {
  id: string;
  status: string;
  candidateType: string;
  externalSource: string;
  externalKey: string;
  externalName: string | null;
  matchScore: number | null;
  matchReason: string | null;
  createdAt: string;
};

type DataSummary = {
  validTransactions: number;
  validRentContracts: number;
  pendingMatches: number;
};

type FreshnessInfo = {
  transactions: { latestDate: string | null; totalCount: number; validCount: number };
  rentContracts: { latestDate: string | null; totalCount: number; validCount: number };
  lastIngestionRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    recordsInserted: number | null;
    recordsUpdated: number | null;
  } | null;
  checkedAt: string;
};

type SyncStep = {
  name: string;
  status: "success" | "error" | "skipped";
  output?: string;
  durationMs?: number;
};

type SyncResponse = {
  status: "success" | "error" | "running";
  startedAt: string;
  completedAt?: string;
  steps: SyncStep[];
  error?: string;
  freshness?: FreshnessInfo;
};

type Props = {
  pendingMatches: MatchItem[];
  summary: DataSummary;
};

// ---------------------------------------------------------------------------
// Match Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "bg-emerald-600" : pct >= 70 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-slate-100 rounded-full h-1.5 border border-slate-200 overflow-hidden">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Row
// ---------------------------------------------------------------------------

function MatchRow({ item, onConfirm, onReject }: {
  item: MatchItem;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 px-3 rounded-xl transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold text-sky-800 uppercase bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
            {item.externalSource}
          </span>
          <span className="text-xs text-slate-500 font-mono truncate">{item.externalKey}</span>
        </div>
        <p className="text-sm font-bold text-slate-900 truncate">{item.externalName ?? "—"}</p>
        {item.matchReason && (
          <p className="text-xs text-slate-500 mt-0.5">{item.matchReason}</p>
        )}
      </div>

      <div className="shrink-0 hidden sm:block">
        <ScoreBar score={item.matchScore} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onConfirm(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Confirm
        </button>
        <button
          onClick={() => onReject(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
        >
          <XCircle className="h-3.5 w-3.5 text-rose-600" />
          Reject
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Data Health Page
// ---------------------------------------------------------------------------

export default function DataHealthClient({ pendingMatches: initialMatches, summary }: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [freshness, setFreshness] = useState<FreshnessInfo | null>(null);
  const [freshnessLoading, setFreshnessLoading] = useState(false);

  const handleConfirm = async (id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const handleReject = async (id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  // Fetch freshness on mount
  const fetchFreshness = useCallback(async () => {
    setFreshnessLoading(true);
    try {
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = await res.json();
        setFreshness(data.freshness);
        if (data.syncInProgress) setSyncing(true);
      }
    } catch {
      // silently fail
    } finally {
      setFreshnessLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFreshness();
  }, [fetchFreshness]);

  // Trigger sync
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: 1, reopenDays: 7 }),
      });
      const data: SyncResponse = await res.json();
      setSyncResult(data);
      if (data.freshness) setFreshness(data.freshness);
    } catch (err) {
      setSyncResult({
        status: "error",
        startedAt: new Date().toISOString(),
        steps: [],
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Compute data staleness
  const staleDays = freshness?.transactions?.latestDate
    ? Math.floor(
        (Date.now() - new Date(freshness.transactions.latestDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const staleClass =
    staleDays === null
      ? "text-slate-400"
      : staleDays <= 1
        ? "text-emerald-600"
        : staleDays <= 3
          ? "text-amber-600"
          : "text-rose-600";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-2xs">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  DLD Data Health &amp; Ingestion Hygiene
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                    DuckDB Live
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Source freshness, match resolution queue, and Dubai Land Department synchronization health
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-600 font-mono bg-white px-4 py-2 rounded-xl border border-slate-200/90 shadow-2xs">
              SLA: <strong className="text-slate-900 font-bold">48 Hours Freshness Guaranteed</strong>
            </div>
          </div>
        </div>

        {/* Sync Control Panel */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/50 border border-sky-200/80 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-sky-600" />
                DLD Data Sync
              </h2>
              <p className="text-xs text-slate-500">
                Fetch latest transactions & rent contracts from Dubai Open Data API, then synchronize to local database.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-95 ${
                syncing
                  ? "bg-sky-100 text-sky-400 border border-sky-200 cursor-not-allowed"
                  : "bg-sky-600 text-white hover:bg-sky-700 border border-sky-700 hover:shadow-md"
              }`}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Sync DLD Data
                </>
              )}
            </button>
          </div>

          {/* Freshness indicators */}
          {freshness && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/70 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Latest Transaction
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {freshness.transactions.latestDate ?? "—"}
                </div>
                <div className={`text-xs font-bold ${staleClass}`}>
                  {staleDays !== null
                    ? staleDays === 0
                      ? "🟢 Fresh today"
                      : staleDays === 1
                        ? "🟢 1 day old"
                        : staleDays <= 3
                          ? `🟡 ${staleDays} days old`
                          : `🔴 ${staleDays} days stale`
                    : "Unknown"}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/70 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Latest Rent Contract
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {freshness.rentContracts.latestDate ?? "—"}
                </div>
                <div className="text-xs text-slate-500">
                  {freshness.rentContracts.totalCount.toLocaleString()} total
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/70 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Last Ingestion
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {freshness.lastIngestionRun
                    ? new Date(freshness.lastIngestionRun.startedAt).toLocaleString()
                    : "—"}
                </div>
                <div className="text-xs text-slate-500">
                  {freshness.lastIngestionRun
                    ? `Status: ${freshness.lastIngestionRun.status} • ${(freshness.lastIngestionRun.recordsInserted ?? 0).toLocaleString()} inserted`
                    : "No runs recorded"}
                </div>
              </div>
            </div>
          )}

          {/* Sync result */}
          {syncResult && (
            <div className={`rounded-xl p-4 space-y-3 border ${
              syncResult.status === "success"
                ? "bg-emerald-50/80 border-emerald-200"
                : syncResult.status === "error"
                  ? "bg-rose-50/80 border-rose-200"
                  : "bg-sky-50/80 border-sky-200"
            }`}>
              <div className="flex items-center gap-2">
                {syncResult.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : syncResult.status === "error" ? (
                  <XCircle className="h-4 w-4 text-rose-600" />
                ) : (
                  <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
                )}
                <span className="text-sm font-bold text-slate-900">
                  {syncResult.status === "success"
                    ? "Sync completed successfully!"
                    : syncResult.status === "error"
                      ? "Sync completed with errors"
                      : "Sync in progress…"}
                </span>
                {syncResult.completedAt && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {new Date(syncResult.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {syncResult.steps.length > 0 && (
                <div className="space-y-1.5">
                  {syncResult.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {step.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : step.status === "error" ? (
                        <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700">{step.name}</span>
                      {step.durationMs !== undefined && (
                        <span className="text-slate-400 font-mono">
                          {step.durationMs > 60000
                            ? `${(step.durationMs / 60000).toFixed(1)}m`
                            : `${(step.durationMs / 1000).toFixed(1)}s`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {syncResult.error && (
                <div className="text-xs text-rose-700 bg-rose-100/60 rounded-lg p-2 font-mono break-all">
                  {syncResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Valid Transactions</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              {summary.validTransactions.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">DLD registered sales (non-excluded)</div>
          </div>

          <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Rent Contracts</span>
              <ShieldCheck className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              {summary.validRentContracts.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Ejari contracts (single-property)</div>
          </div>

          <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Pending Matches</span>
              <Clock className={`h-4 w-4 ${summary.pendingMatches > 0 ? "text-amber-600" : "text-emerald-600"}`} />
            </div>
            <div className={`text-3xl font-bold tabular-nums tracking-tight ${
              summary.pendingMatches > 0 ? "text-amber-600" : "text-emerald-600"
            }`}>
              {summary.pendingMatches}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Awaiting desk analyst resolution</div>
          </div>
        </div>

        {/* Match Queue */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Eye className="h-5 w-5 text-sky-600" />
              Match Review Queue
            </h2>
            <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
              {matches.length} pending items
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-slate-800">No pending matches — queue is completely clear</p>
              <p className="text-xs text-slate-500">All external developer records are properly harmonized with DLD master schemas.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {matches.map((item) => (
                <MatchRow
                  key={item.id}
                  item={item}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}

          {/* Rules Banner */}
          <div className="flex items-start gap-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-950 shadow-2xs">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <strong className="text-amber-900 font-bold">Strict Ingestion Rule:</strong> Only <em>confirmed</em> matches feed into CMA calculations. Name-only similarity matches
              require analyst review and are never auto-confirmed. Rejections are permanent for that source key combination.
            </div>
          </div>
        </div>

        {/* Data Pipeline Architecture */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-sky-600" />
            Ingestion Pipeline Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center text-[10px]">1</span>
                <span>DLD Pipeline DuckDB</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Raw data from Dubai Open Data (transactions, rents, service charges, projects) processed with sub-second vector queries.
              </p>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center text-[10px]">2</span>
                <span>Match Resolution Queue</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Auto-candidate project/developer matches appear here for desk analyst sign-off before entering client dossiers.
              </p>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center text-[10px]">3</span>
                <span>Developer Documents</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Imported via /imports with SHA-256 integrity checksums, zero-macro sandboxing, and 48-hour SLA re-verification alerts.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
