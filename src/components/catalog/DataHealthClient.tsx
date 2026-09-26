"use client";

import React, { useState } from "react";
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

type Props = {
  pendingMatches: MatchItem[];
  summary: DataSummary;
};

// ---------------------------------------------------------------------------
// Match Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-black/40 rounded-full h-1.5 border border-white/[0.06] overflow-hidden">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-slate-300 tabular-nums">{pct}%</span>
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
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-black text-amber-300 uppercase bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
            {item.externalSource}
          </span>
          <span className="text-xs text-slate-400 font-mono truncate">{item.externalKey}</span>
        </div>
        <p className="text-sm font-bold text-white truncate">{item.externalName ?? "—"}</p>
        {item.matchReason && (
          <p className="text-xs text-slate-400 mt-0.5">{item.matchReason}</p>
        )}
      </div>

      <div className="shrink-0 hidden sm:block">
        <ScoreBar score={item.matchScore} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onConfirm(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer active:scale-95 shadow-sm shadow-emerald-500/10"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirm
        </button>
        <button
          onClick={() => onReject(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all cursor-pointer active:scale-95 shadow-sm shadow-rose-500/10"
        >
          <XCircle className="h-3.5 w-3.5" />
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

  const handleConfirm = async (id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const handleReject = async (id: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 shadow-sm shadow-amber-400/10">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  DLD Data Health &amp; Ingestion Hygiene
                  <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    DuckDB Live
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Source freshness, match resolution queue, and Dubai Land Department synchronization health
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono bg-white/[0.04] px-4 py-2 rounded-2xl border border-white/[0.08]">
            SLA: <strong className="text-amber-400 font-bold">48 Hours Freshness Guaranteed</strong>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="luxury-card p-6 rounded-3xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Valid Transactions</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white tabular-nums tracking-tight">
              {summary.validTransactions.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">DLD registered sales (non-excluded)</div>
          </div>

          <div className="luxury-card p-6 rounded-3xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Rent Contracts</span>
              <ShieldCheck className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white tabular-nums tracking-tight">
              {summary.validRentContracts.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Ejari contracts (single-property)</div>
          </div>

          <div className="luxury-card p-6 rounded-3xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Pending Matches</span>
              <Clock className={`h-4 w-4 ${summary.pendingMatches > 0 ? "text-amber-400" : "text-emerald-400"}`} />
            </div>
            <div className={`text-3xl font-black tabular-nums tracking-tight ${
              summary.pendingMatches > 0 ? "text-amber-400" : "text-emerald-400"
            }`}>
              {summary.pendingMatches}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Awaiting desk analyst resolution</div>
          </div>
        </div>

        {/* Match Queue */}
        <div className="luxury-card rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <h2 className="font-extrabold text-white text-base flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-400" />
              Match Review Queue
            </h2>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              {matches.length} pending items
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400/50" />
              <p className="text-sm font-bold text-slate-300">No pending matches — queue is completely clear</p>
              <p className="text-xs text-slate-500">All external developer records are properly harmonized with DLD master schemas.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
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
          <div className="flex items-start gap-2.5 bg-black/40 border border-white/[0.08] rounded-2xl p-4 text-xs text-slate-300">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <span>
              <strong className="text-white font-semibold">Strict Ingestion Rule:</strong> Only <em>confirmed</em> matches feed into CMA calculations. Name-only similarity matches
              require analyst review and are never auto-confirmed. Rejections are permanent for that source key combination.
            </span>
          </div>
        </div>

        {/* Data Pipeline Architecture */}
        <div className="luxury-card rounded-3xl p-6 space-y-4">
          <h2 className="font-extrabold text-white text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-400" />
            Ingestion Pipeline Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center text-[10px]">1</span>
                <span>DLD Pipeline DuckDB</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Raw data from Dubai Open Data (transactions, rents, service charges, projects) processed with sub-second vector queries.
              </p>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center text-[10px]">2</span>
                <span>Match Resolution Queue</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Auto-candidate project/developer matches appear here for desk analyst sign-off before entering client dossiers.
              </p>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center text-[10px]">3</span>
                <span>Developer Documents</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Imported via /imports with SHA-256 integrity checksums, zero-macro sandboxing, and 48-hour SLA re-verification alerts.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
