"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/desk/Header";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Building2,
  Calendar,
  Layers,
  Bot,
  RefreshCw,
} from "lucide-react";
import type { ShortlistResult } from "@/domain/alternatives/shortlist";

type Props = {
  initialData: ShortlistResult & {
    aiCommentary?: { summary: string; keyTakeaway: string; source: string };
  };
};

export function AlternativesClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [budget, setBudget] = useState(1800000);
  const [strategy, setStrategy] = useState<"flip" | "rental" | "capital_gain">("flip");
  const [bedrooms, setBedrooms] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (targetBudget = budget, targetStrat = strategy, targetBed = bedrooms) => {
    setLoading(true);
    try {
      const res = await fetch("/api/alternatives/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetAed: targetBudget,
          targetStrategy: targetStrat,
          targetBedrooms: [targetBed],
          preferredAreaName: "Business Bay",
          withAiCommentary: true,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to generate shortlist:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
              Section 8 Engine &bull; Phase 3 Compliance
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-2xs">
                <Layers className="h-6 w-6" />
              </div>
              Alternatives &amp; Shortlist Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
              Deterministic eligibility evaluation, dominated option filtering, and 3-role portfolio selection with verified analytical commentary.
            </p>
          </div>

          {/* Action button */}
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Evaluating Candidates..." : "Recalculate Shortlist"}
          </button>
        </div>

        {/* Client Brief Selector Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Budget */}
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-2">
              Client Capital Ticket Budget (AED)
            </label>
            <div className="flex items-center gap-2">
              {[1400000, 1800000, 2500000].map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setBudget(b);
                    handleGenerate(b, strategy, bedrooms);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    budget === b
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {(b / 1000000).toFixed(1)}M AED
                </button>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-2">
              Target Investment Strategy
            </label>
            <div className="flex items-center gap-2">
              {(["flip", "rental", "capital_gain"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStrategy(s);
                    handleGenerate(budget, s, bedrooms);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    strategy === s
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {s === "flip" ? "Capital Flip" : s === "rental" ? "Rental Yield" : "Long Growth"}
                </button>
              ))}
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-2">
              Target Unit Format
            </label>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((br) => (
                <button
                  key={br}
                  onClick={() => {
                    setBedrooms(br);
                    handleGenerate(budget, strategy, br);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bedrooms === br
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {br === 0 ? "Studio" : `${br}BR`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Executive Commentary Banner */}
        {data.aiCommentary && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm relative overflow-hidden space-y-3.5 border-l-4 border-l-sky-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span>Executive Analytical Synthesis (AI Enhanced)</span>
              </div>
              <span className="text-[10px] font-bold uppercase px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                {data.aiCommentary.source === "gemini_2.5_flash" ? "Verified by our System" : "Deterministic Engine"}
              </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed font-normal">
              {data.aiCommentary.summary}
            </p>

            <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 text-xs text-sky-950 flex items-start gap-3 shadow-2xs">
              <Bot className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-900 font-bold block mb-0.5">Key Strategic Takeaway:</strong>
                <span className="text-sky-900/90">{data.aiCommentary.keyTakeaway}</span>
              </div>
            </div>
          </div>
        )}

        {/* Engine Audit Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-2xs">
            <div className="text-[11px] text-slate-500 font-semibold">Total Evaluated</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{data.totalCandidatesEvaluated} projects</div>
          </div>
          <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-2xs">
            <div className="text-[11px] text-slate-500 font-semibold">Eligible (Passed Gates)</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{data.eligibleCount} candidates</div>
          </div>
          <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-2xs">
            <div className="text-[11px] text-slate-500 font-semibold">Dominated Filtered Out</div>
            <div className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">{data.dominatedCount} inferior</div>
          </div>
          <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-2xs">
            <div className="text-[11px] text-slate-500 font-semibold">Shortlisted Roles</div>
            <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">{data.shortlist.length} selected</div>
          </div>
        </div>

        {/* 3 Shortlisted Cards (§8) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.shortlist.map((item, idx) => {
            const c = item.candidate;
            const exp = item.explanation;

            return (
              <div
                key={c.id || idx}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-sm transition-all"
              >
                <div className="space-y-4">
                  {/* Role Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                      {exp.roleTitle}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {c.expectedHandoverYear}
                    </span>
                  </div>

                  {/* Project Title & Pricing */}
                  <div>
                    <Link
                      href={`/projects/${c.projectId}`}
                      className="text-lg font-bold text-slate-900 hover:text-sky-600 transition-colors flex items-center justify-between group"
                    >
                      <span>{c.projectName}</span>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600" />
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.developerName} &bull; <span className="text-slate-800 font-medium">{c.areaName}</span>
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="bg-slate-50 rounded-xl p-3.5 grid grid-cols-2 gap-3 text-xs border border-slate-200/80 font-mono">
                    <div>
                      <span className="text-slate-500 font-sans text-[11px] block font-medium">Total Price:</span>
                      <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                        {c.priceAed >= 1_000_000 ? `AED ${(c.priceAed / 1_000_000).toFixed(2)}M` : `AED ${Math.round(c.priceAed / 1000)}k`}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans text-[11px] block font-medium">Rate PSF:</span>
                      <div className="text-base font-bold text-emerald-700 mt-0.5 tabular-nums">
                        {c.pricePerSqftAed.toFixed(0)} AED
                      </div>
                    </div>
                  </div>

                  {/* 4 Mandatory Explanation Blocks (§8) */}
                  <div className="space-y-3.5 text-xs">
                    {/* 1. Why it fits */}
                    <div className="space-y-1">
                      <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Почему подходит клиенту:
                      </div>
                      <ul className="list-disc list-inside text-slate-700 space-y-0.5 pl-1 leading-relaxed">
                        {exp.whyItFits.map((arg, i) => (
                          <li key={i}>{arg}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 2. Trade-off */}
                    <div className="space-y-1">
                      <div className="font-bold text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        Существенный компромисс:
                      </div>
                      <p className="text-slate-700 pl-1 leading-relaxed">
                        {exp.tradeOff}
                      </p>
                    </div>

                    {/* 3. Disqualification triggers */}
                    <div className="space-y-1">
                      <div className="font-bold text-rose-700 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                        При каких условиях перестаёт подходить:
                      </div>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5 pl-1 leading-relaxed">
                        {exp.disqualificationTriggers.map((trig, i) => (
                          <li key={i}>{trig}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 4. Facts to verify */}
                    <div className="space-y-1">
                      <div className="font-bold text-sky-700 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-sky-600" />
                        Что ещё подтвердить:
                      </div>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5 pl-1 leading-relaxed">
                        {exp.factsToVerify.map((fact, i) => (
                          <li key={i}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* View CMA Link */}
                <div className="border-t border-slate-100 pt-4">
                  <Link
                    href={`/projects/${c.projectId}/cma`}
                    className="w-full inline-flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-slate-200"
                  >
                    <Building2 className="h-3.5 w-3.5 text-sky-600" />
                    View Project CMA 3-Group Analysis
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
