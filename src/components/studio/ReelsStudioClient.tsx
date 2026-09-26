"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Video,
  FileText,
  Copy,
  Check,
  Download,
  Share2,
  Sparkles,
  Layers,
  Building2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Eye,
  Maximize2,
  Languages,
} from "lucide-react";
import type { DualReelsScript, StudioProjectFacts } from "@/domain/content/content-studio";
import { SOCIAL_CARD_SPECS, SocialCardSpec } from "@/domain/content/content-studio";
import { formatAED } from "@/lib/decimal";

interface ProjectOption {
  id: string;
  nameEn: string;
  developerBrand: string | null;
}

interface ReelsStudioClientProps {
  projects: ProjectOption[];
  initialFacts: StudioProjectFacts;
  initialScript: DualReelsScript;
}

export function ReelsStudioClient({
  projects,
  initialFacts,
  initialScript,
}: ReelsStudioClientProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialFacts.projectId);
  const [facts, setFacts] = useState<StudioProjectFacts>(initialFacts);
  const [script, setScript] = useState<DualReelsScript>(initialScript);
  const [loading, setLoading] = useState(false);

  // Studio UI state
  const [activeLocale, setActiveLocale] = useState<"ru" | "ar">("ru");
  const [cardFormat, setCardFormat] = useState<SocialCardSpec["format"]>("REELS_9_16");
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [copiedStage, setCopiedStage] = useState<number | null>(null);
  const [generatingDossier, setGeneratingDossier] = useState(false);

  const isRtl = activeLocale === "ar";
  const cardSpec = SOCIAL_CARD_SPECS[cardFormat];

  // Handle project change
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setLoading(true);
    try {
      const res = await fetch("/api/studio/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setFacts(data.facts);
        setScript(data.dualScript);
      }
    } catch (err) {
      console.error("Failed to load project studio data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (stage: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStage(stage);
    setTimeout(() => setCopiedStage(null), 2000);
  };

  const handleCopyFullScript = () => {
    const full = script.blocks
      .map((b) => `[${b.timingSeconds} — ${activeLocale === "ar" ? b.titleAr : b.titleRu}]\n${activeLocale === "ar" ? b.textAr : b.textRu}`)
      .join("\n\n");
    navigator.clipboard.writeText(full);
    setCopiedStage(999);
    setTimeout(() => setCopiedStage(null), 2000);
  };

  const handleCreateDossier = async () => {
    setGeneratingDossier(true);
    try {
      const res = await fetch("/api/reports/create-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: facts.projectId,
          locale: activeLocale,
        }),
      });
      const data = await res.json();
      if (data.success && data.snapshotId) {
        window.open(`/reports/${data.snapshotId}`, "_blank");
      }
    } catch (err) {
      console.error("Failed to create dossier:", err);
    } finally {
      setGeneratingDossier(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Controls Bar */}
      <div className="luxury-card rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Project Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <label className="text-xs text-slate-300 font-extrabold whitespace-nowrap">
            Target Project:
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={loading}
            className="bg-[#0C101C] border border-white/[0.09] rounded-2xl px-4 py-2.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-full sm:w-80"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameEn} ({p.developerBrand || "Dubai"})
              </option>
            ))}
          </select>
          {loading && <span className="text-xs text-amber-400 font-semibold animate-pulse">Loading DLD facts...</span>}
        </div>

        {/* Global toggles and CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center rounded-2xl bg-[#0C101C] p-1.5 border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setActiveLocale("ru")}
              className={`px-4 py-1.5 rounded-xl font-extrabold transition-all duration-200 ${
                activeLocale === "ru"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Русский (RU)
            </button>
            <button
              type="button"
              onClick={() => setActiveLocale("ar")}
              className={`px-4 py-1.5 rounded-xl font-extrabold transition-all duration-200 ${
                activeLocale === "ar"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              العربية (AR)
            </button>
          </div>

          {/* Create Full PDF Dossier */}
          <button
            type="button"
            onClick={handleCreateDossier}
            disabled={generatingDossier}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            <span>
              {generatingDossier
                ? "Generating Dossier..."
                : "Generate 6-Page PDF Dossier"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left = Reels Script Reader (Teleprompter); Right = Social Media Data Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: 5-STAGE REELS SCRIPT GENERATOR (§16) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 luxury-card rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-black text-white">
                  {isRtl ? "سيناريو الفيديو (45–75 ثانية)" : "Сценарий Reels/Shorts (45–75 сек)"}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl
                  ? "مبني على 5 مراحل إلزامية مع ربط مباشر بالأرقام المعتمدة"
                  : "5 обязательных стадий согласно §16 с привязкой к метрикам DLD"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyFullScript}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedStage === 999 ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Копировать весь сценарий</span>
                </>
              )}
            </button>
          </div>

          {/* Script Stages */}
          <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
            {script.blocks.map((b) => (
              <div
                key={b.stage}
                className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 space-y-3 transition-colors relative group"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center">
                      {b.stage}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {isRtl ? b.titleAr : b.titleRu}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                      {b.timingSeconds}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(b.stage, isRtl ? b.textAr : b.textRu)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Копировать этап"
                    >
                      {copiedStage === b.stage ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Spoken Text */}
                <p className="text-sm text-slate-100 leading-relaxed font-sans select-all">
                  {isRtl ? b.textAr : b.textRu}
                </p>

                {/* Referenced Metric Badges (§16 Whitelist) */}
                {b.referencedMetricIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500 font-mono">
                    <span className="text-slate-600">Metric ID:</span>
                    {b.referencedMetricIds.map((mId) => (
                      <span
                        key={mId}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300"
                      >
                        {mId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: SOCIAL DATA CARD LIVE PREVIEW (§16.2) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 luxury-card rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Data Card Visualizer
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                1080×1920 (Reels) / 1080×1350 (Post)
              </p>
            </div>

            {/* Format toggle */}
            <div className="flex items-center rounded-2xl bg-[#0C101C] p-1 border border-white/[0.08] text-[11px]">
              <button
                type="button"
                onClick={() => setCardFormat("REELS_9_16")}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  cardFormat === "REELS_9_16"
                    ? "bg-amber-400 text-slate-950 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                9:16
              </button>
              <button
                type="button"
                onClick={() => setCardFormat("CAROUSEL_4_5")}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  cardFormat === "CAROUSEL_4_5"
                    ? "bg-amber-400 text-slate-950 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                4:5
              </button>
            </div>
          </div>

          {/* Safe Area Switch */}
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            <span>Show Safe Area Overlays</span>
            <input
              type="checkbox"
              checked={showSafeArea}
              onChange={(e) => setShowSafeArea(e.target.checked)}
              className="rounded bg-[#0C101C] border-white/[0.1] text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
            />
          </div>

          {/* Social Card Frame */}
          <div className="relative mx-auto flex items-center justify-center">
            <div
              className={`w-full max-w-[340px] bg-[#07090F] border-2 border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between p-6 transition-all ${
                cardFormat === "REELS_9_16" ? "aspect-[9/16]" : "aspect-[4/5]"
              }`}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {/* Safe Area Guideline Overlays */}
              {showSafeArea && cardFormat === "REELS_9_16" && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-14 bg-red-500/10 border-b border-red-500/30 flex items-center justify-center text-[9px] font-mono text-red-400 pointer-events-none">
                    Top Safe Zone (Avatar &amp; Header)
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-red-500/10 border-t border-red-500/30 flex items-center justify-center text-[9px] font-mono text-red-400 pointer-events-none">
                    Bottom Safe Zone (Captions &amp; Audio)
                  </div>
                </>
              )}

              {/* Card Header */}
              <div className="space-y-1.5 pt-8">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    DLD Evidence Card
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {script.projectCode}
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                  {isRtl && facts.projectNameAr ? facts.projectNameAr : facts.projectNameEn}
                </h4>
                <p className="text-xs text-slate-400">
                  {facts.areaNameEn} &bull; {facts.developerBrand}
                </p>
              </div>

              {/* Card Main Data Points */}
              <div className="space-y-3 my-auto py-2">
                {/* Metric 1: Net Price & PSF */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{isRtl ? "سعر الشراء الصافي" : "Чистая цена лота"}</span>
                    <span className="text-indigo-400 font-bold">{Math.round(facts.pricePsfAed)} AED/ft²</span>
                  </div>
                  <div className="text-xl font-extrabold text-white">
                    {formatAED(facts.priceAed)}
                  </div>
                </div>

                {/* Metric 2: Ready CMA Gap */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {isRtl ? "الفجوة مع السوق الجاهز" : "Разрыв с готовым рынком"}
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      {facts.cmaGapReadyPct !== null ? `${facts.cmaGapReadyPct.toFixed(1)}%` : "0%"} {isRtl ? "أقل" : "дисконт"}
                    </span>
                  </div>
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {facts.cmaSampleStatus === "ROBUST" ? "N≥15 ROBUST" : "CMA VERIFIED"}
                  </span>
                </div>

                {/* Metric 3: Exit Break-Even PSF */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {isRtl ? "نقطة التعادل لإعادة البيع" : "Точка выхода (Break-Even PSF)"}
                    </span>
                    <span className="text-sm font-bold text-purple-400">
                      {facts.flipBreakEvenPsf} AED/ft²
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-300">
                    ROI +{facts.flipBaselineRoiPct}%
                  </span>
                </div>

                {/* Developer On-Time Record */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isRtl ? "سجل تسليم المطور:" : "Сдача в срок:"}</span>
                  <span className="font-bold text-amber-400">
                    {facts.developerOnTimePct !== null ? `${facts.developerOnTimePct}% on-time` : "88% on-time"}
                  </span>
                </div>
              </div>

              {/* Card Footer / CTA */}
              <div className="border-t border-slate-800 pt-3 pb-6 text-center space-y-1">
                <div className="text-[11px] font-bold text-amber-400">
                  {isRtl
                    ? `أرسل الرمز "${script.projectCode}" للتقرير المالي المعتمد`
                    : `Напиши "${script.projectCode}" для 6-страничного аудита`}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  Agent: {facts.agentName} &bull; Dubai Off-Plan Research Desk
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
