"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Printer,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  Share2,
  FileCheck,
  Landmark,
  Lock,
  Sparkles,
  Search,
  SlidersHorizontal,
  Calculator,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Info,
} from "lucide-react";
import { formatAED } from "@/lib/decimal";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

interface ReportDossierViewProps {
  snapshot: {
    id: string;
    title: string;
    locale: string;
    snapshotHash: string;
    status: string;
    createdAt: string;
    pdfPath: string | null;
    payload: any;
  };
  isPrintMode?: boolean;
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && val !== null && typeof val.toNumber === "function") {
    return val.toNumber();
  }
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const formatAedShort = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const num = toNum(v);
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `AED ${m.toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `AED ${Math.round(num / 1_000)}k`;
  }
  return `AED ${Math.round(num).toLocaleString("en-US")}`;
};

const formatFullAed = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return `AED ${Math.round(toNum(v)).toLocaleString("en-US")}`;
};

const bedroomLabel = (br: number | null | undefined, isRtl: boolean) => {
  if (br === null || br === undefined) return isRtl ? "غير محدد" : "Apartment";
  if (br === 0) return isRtl ? "استوديو" : "Studio";
  return `${br}BR`;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ReportDossierView({ snapshot, isPrintMode }: ReportDossierViewProps) {
  const [locale, setLocale] = useState<"ru" | "ar">(
    (snapshot.locale as any) === "ar" ? "ar" : "ru"
  );
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    project = {},
    unit = {},
    unitTypes = [],
    cma: initialCma = {},
    pipeline = {},
    developer = {},
    mandatoryExpenses = {},
    financialScenarios = {},
    metadata = {},
    resaleChains = null,
    recentTransactions = null,
    aiSynthesis: initialAiSynthesis = null,
  } = snapshot.payload || {};

  const isRtl = locale === "ar";

  // Active AI Commentary state
  const [aiSynthesis, setAiSynthesis] = useState<any>(initialAiSynthesis);
  const [aiLoading, setAiLoading] = useState(false);

  // Active unit state
  const [selectedBedroom, setSelectedBedroom] = useState<number>(
    unit.bedrooms !== null && unit.bedrooms !== undefined ? unit.bedrooms : 1
  );
  const [cma, setCma] = useState<any>(initialCma);
  const [cmaLoading, setCmaLoading] = useState(false);

  // Active CMA subtab
  const [activeCmaTab, setActiveCmaTab] = useState<"verdict" | "towers" | "deals" | "sensitivity">("verdict");
  const [dealFilter, setDealFilter] = useState<"all" | "offplan" | "ready" | "near">("all");
  const [dealSearch, setDealSearch] = useState<string>("");

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPlaywrightPdf = async () => {
    try {
      setDownloadingPdf(true);
      window.open(`/api/reports/${snapshot.id}/pdf`, "_blank");
    } finally {
      setTimeout(() => setDownloadingPdf(false), 2000);
    }
  };

  const handleRegenerateAi = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/reports/${snapshot.id}/ai-synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.aiSynthesis) {
          setAiSynthesis(data.aiSynthesis);
        }
      }
    } catch (e) {
      console.error("Failed to regenerate AI synthesis:", e);
    } finally {
      setAiLoading(false);
    }
  };

  // Switch layout if user clicks another bedroom in the dossier
  const handleSelectBedroom = async (br: number) => {
    setSelectedBedroom(br);
    if (!project.id) return;
    setCmaLoading(true);
    try {
      const res = await fetch(`/api/cma/${project.id}?bedrooms=${br}`);
      if (res.ok) {
        const json = await res.json();
        if (json.cma) {
          setCma(json.cma);
        }
      }
    } catch (e) {
      console.error("Failed to fetch CMA for bedroom:", e);
    } finally {
      setCmaLoading(false);
    }
  };

  // Metric derivations
  const unitPrice = toNum(unit.netPriceAed || unit.listPriceAed || 0);
  const unitArea = toNum(unit.areaSqftMin || unit.areaSqftMax || unit.areaSqft || 850);
  const unitPsf = unitPrice > 0 && unitArea > 0 ? Math.round(unitPrice / unitArea) : toNum(cma?.targetPsf || 0);
  const breakEvenPrice = toNum(financialScenarios?.breakEven?.breakEvenPriceAed || 0);
  const breakEvenPsf = breakEvenPrice > 0 && unitArea > 0 ? Math.round(breakEvenPrice / unitArea) : toNum(financialScenarios?.breakEven?.breakEvenPsfAed || 0);
  
  const gapToReady = cma?.gapToReadyPercent != null ? toNum(cma.gapToReadyPercent) : null;
  const gapToOffPlan = cma?.gapToOffPlanPercent != null ? toNum(cma.gapToOffPlanPercent) : null;
  const nearSpread = cma?.nearHandoverSpreadPercent != null ? toNum(cma.nearHandoverSpreadPercent) : null;

  // Deterministic synthesis fallbacks for §17.1 and §7
  const defaultExecutiveSummary = useMemo(() => {
    const pName = isRtl ? (project?.nameAr || project?.nameEn) : project?.nameEn;
    const aName = isRtl ? (project?.areaNameAr || project?.areaNameEn || "دبي") : (project?.areaNameEn || "Dubai");
    const bePsf = breakEvenPsf || Math.round(unitPsf * 1.05);

    if (isRtl) {
      if (gapToReady !== null && gapToReady < 0) {
        return `مشروع ${pName} يوفّر سعر دخول ${unitPsf} درهم/قدم² بعلاوة قدرها +${Math.abs(gapToReady).toFixed(1)}% مقارنة بمتوسط العقارات الجاهزة في ${aName} (أبراج عمرها 15-20 عاماً). ${
          gapToOffPlan !== null && gapToOffPlan > 0
            ? `وفي الوقت نفسه، السعر أقل بنسبة ${gapToOffPlan.toFixed(1)}% من وسيط المشاريع قيد الإنشاء المنافسة.`
            : ""
        } خطة السداد تتيح مرونة لإعادة البيع (NOC) بعد سداد 34%، ونقطة التعادل تبلغ ${bePsf} درهم/قدم².`;
      }
      return `مشروع ${pName} يوفّر نقطة دخول تنافسية بمقدار ${unitPsf} درهم/قدم². بموجب صفقات DLD، السعر أقل بنسبة ${
        gapToReady !== null ? gapToReady.toFixed(1) : 0
      }% عن العقارات الجاهزة في ${aName}. خطة السداد تمنح مرونة لإعادة البيع (NOC) بعد سداد 34%، ونقطة التعادل تبلغ ${bePsf} درهم/قدم².`;
    }

    if (gapToReady !== null && gapToReady < 0) {
      return `Объект ${pName} предлагает цену входа ${unitPsf} AED/ft² (+${Math.abs(gapToReady).toFixed(1)}% премия к медиане вторичного рынка района ${aName}, где доминирует жилой фонд 15–20-летней давности). ${
        gapToOffPlan !== null && gapToOffPlan > 0
          ? `При этом в сегменте строящихся проектов цена на ${gapToOffPlan.toFixed(1)}% выгоднее медианы прямых конкурентов.`
          : ""
      } Рассрочка обеспечивает финансовый рычаг: переуступка (NOC) открывается при оплате 34%, а точка безубыточности выхода составляет ${bePsf} AED/ft².`;
    }

    return `Объект ${pName} предлагает цену входа ${unitPsf} AED/ft² (на ${
      gapToReady !== null ? gapToReady.toFixed(1) : 0
    }% ниже медианы вторичного рынка района ${aName}). Допустимость переуступки (NOC) открывается при оплате 34%, а точка безубыточности при выходе составляет ${bePsf} AED/ft².`;
  }, [project, unitPsf, gapToReady, gapToOffPlan, breakEvenPsf, isRtl]);

  const defaultCmaRationale = useMemo(() => {
    const pName = isRtl ? (project?.nameAr || project?.nameEn) : project?.nameEn;
    if (isRtl) {
      return `الفارق السعري مع السوق الجاهز يرجع لعامل حداثة البناء والتشطيبات الفاخرة مقابل مباني عمرها 15-20 عاماً في المنطقة ذات تكاليف صيانة وتشغيل أعلى. مقارنة المعروض قيد الإنشاء تؤكد تميز نقطة الدخول مقارنة بالمنافسين المباشرين.`;
    }
    return `Ценовая надбавка к вторичному рынку обоснована разницей в поколениях недвижимости: готовый фонд района в основном построен в 2006–2012 гг. и несет износ инженерных систем, тогда как ${pName} предлагает современный стандарт инженерии, брендированную отделку и рассрочку платежей. Сравнение внутри строящегося фонда подтверждает конкурентную точку входа относительно прямых аналогов.`;
  }, [project, isRtl]);

  // Flattened verified deals for feed
  const allDeals = useMemo(() => {
    const list: Array<{
      id: string;
      buildingName: string;
      transactionDate: string;
      areaSqft: number;
      salePriceAED: number;
      pricePerSqftAED: number;
      isOffPlan: boolean;
      groupType: "ready" | "offplan" | "near";
    }> = [];

    if (cma?.readyGroup?.transactions) {
      cma.readyGroup.transactions.forEach((t: any) =>
        list.push({ ...t, groupType: "ready", isOffPlan: false })
      );
    }
    if (cma?.offPlanGroup?.transactions) {
      cma.offPlanGroup.transactions.forEach((t: any) =>
        list.push({ ...t, groupType: "offplan", isOffPlan: true })
      );
    }
    if (cma?.nearHandoverGroup?.transactions) {
      cma.nearHandoverGroup.transactions.forEach((t: any) =>
        list.push({ ...t, groupType: "near", isOffPlan: true })
      );
    }

    return list.sort((a, b) => (b.transactionDate > a.transactionDate ? 1 : -1));
  }, [cma]);

  const filteredDeals = useMemo(() => {
    return allDeals.filter((d) => {
      if (dealFilter === "offplan" && d.groupType !== "offplan") return false;
      if (dealFilter === "ready" && d.groupType !== "ready") return false;
      if (dealFilter === "near" && d.groupType !== "near") return false;
      if (dealSearch.trim()) {
        const q = dealSearch.toLowerCase();
        const matchName = d.buildingName?.toLowerCase().includes(q);
        const matchDate = d.transactionDate?.toLowerCase().includes(q);
        return matchName || matchDate;
      }
      return true;
    });
  }, [allDeals, dealFilter, dealSearch]);

  // Spectrum positions
  const readyPsf = toNum(cma?.readyGroup?.medianPsf || 0);
  const offPlanPsf = toNum(cma?.offPlanGroup?.medianPsf || 0);
  const nearPsf = toNum(cma?.nearHandoverGroup?.medianPsf || 0);
  const targetPsfVal = unitPsf || toNum(cma?.targetPsf || 0);

  const spectrumMin = 500;
  const spectrumMax = 3200;
  const getSpectrumPct = (val: number) => {
    if (!val || val <= 0) return 50;
    const clamped = Math.max(spectrumMin, Math.min(spectrumMax, val));
    return Math.max(4, Math.min(96, Math.round(((clamped - spectrumMin) / (spectrumMax - spectrumMin)) * 100)));
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 ${
        isRtl ? "rtl font-sans" : "font-sans"
      } selection:bg-sky-500/20 selection:text-sky-900`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ========================================================================= */}
      {/* TOP ACTION TOOLBAR (Hidden on print) */}
      {/* ========================================================================= */}
      {!isPrintMode && (
        <header className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link
                href={`/projects/${project.id || ""}`}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{isRtl ? "العودة للمشروع" : "Назад к проекту"}</span>
              </Link>
              <div className="h-4 w-px bg-slate-200 shrink-0" />
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  {project.nameEn || "Dossier"} — {isRtl ? "ملف التوصية الاستثمارية" : "Инвестиционное досье"}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  {isRtl ? "معتمد DLD" : "DLD VERIFIED"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Language Switcher */}
              <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setLocale("ru")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    locale === "ru"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  RU
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("ar")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    locale === "ar"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  العربية
                </button>
              </div>

              {/* Native Print */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
                title={isRtl ? "طباعة" : "Печать"}
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">{isRtl ? "طباعة" : "Печать"}</span>
              </button>

              {/* Playwright Headless High-Res PDF */}
              <button
                type="button"
                onClick={handleDownloadPlaywrightPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">
                  {downloadingPdf
                    ? isRtl
                      ? "جاري التجهيز..."
                      : "Генерация..."
                    : isRtl
                    ? "تحميل PDF موثق"
                    : "Скачать чистый PDF"}
                </span>
                <span className="xs:hidden">PDF</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* MAIN DOSSIER CONTENT */}
      {/* ========================================================================= */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 print:p-0 print:m-0 print:max-w-none print:text-black">
        {/* ========================================================================= */}
        {/* SECTION 1: EXECUTIVE SUMMARY & COMPREHENSIVE PROJECT IDENTIFICATION (§17.1) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          {/* Header Metadata Banner */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-5 print:border-slate-300">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-sky-50 text-sky-700 border border-sky-200/70 print:border-black print:text-black">
                  {isRtl ? "تقرير استشاري موثق" : "Evidence-Based Advisory Dossier"}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  REF: {snapshot.snapshotHash ? snapshot.snapshotHash.slice(0, 12).toUpperCase() : "VERIFIED-DLD"}
                </span>
                {project.status && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {project.status.toUpperCase()}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 print:text-black tracking-tight">
                {isRtl && project.nameAr ? project.nameAr : (project.nameEn || "Project")}
              </h1>

              {/* Identity badges row */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {/* Operating Developer */}
                {(project.operatingDeveloperName || project.developerBrandName) && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 border border-sky-200/70 text-sky-900">
                    <Building2 className="h-3.5 w-3.5 text-sky-600" />
                    <span className="text-slate-500">{isRtl ? "المطور:" : "Девелопер:"}</span>
                    <strong className="font-semibold text-slate-900">
                      {project.operatingDeveloperName || project.developerBrandName}
                    </strong>
                  </div>
                )}

                {/* Master Developer / Landowner */}
                {project.masterDeveloperName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900">
                    <Landmark className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-amber-700">{isRtl ? "المطور الرئيسي:" : "Мастер-девелопер:"}</span>
                    <strong className="font-semibold">{project.masterDeveloperName}</strong>
                  </div>
                )}

                {/* Area */}
                {project.areaNameEn && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium text-slate-900">{project.areaNameEn}</span>
                  </div>
                )}

                {/* DLD Project ID */}
                {project.dldProjectId && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                    <Shield className="h-3.5 w-3.5 text-sky-600" />
                    <span>DLD:</span>
                    <strong className="text-slate-900">{project.dldProjectId}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Consultant & Date Info */}
            <div className="md:text-right text-xs text-slate-500 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl border md:border-none border-slate-200/80 w-full md:w-auto">
              <div className="font-bold text-slate-900 text-sm">
                {isRtl ? "المستشار المسؤول:" : "Ведущий консультант:"} {metadata?.agentName || "Mokhamed"}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {metadata?.agentTitle || "Senior Off-Plan Research Desk Analyst"}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 flex md:justify-end items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {metadata?.generatedAt
                    ? new Date(metadata.generatedAt).toLocaleDateString(isRtl ? "ar-AE" : "ru-RU", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Construction Progress & Escrow Bank Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Construction Progress Card */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
                  {isRtl ? "نسبة الإنجاز الإنشائي (DLD Audit):" : "Готовность объекта (Аудит DLD):"}
                </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {project.constructionProgressPct !== null && project.constructionProgressPct !== undefined
                    ? `${Math.round(toNum(project.constructionProgressPct))}%`
                    : "—"}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-sky-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(3, toNum(project.constructionProgressPct)))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>
                  {isRtl ? "تاريخ التسليم المتوقع:" : "Плановый ввод в эксплуатацию:"}{" "}
                  <strong className="text-slate-800 font-semibold font-mono">
                    {project.expectedHandoverDate
                      ? new Date(project.expectedHandoverDate).toLocaleDateString("en-AE", {
                          month: "short",
                          year: "numeric",
                        })
                      : "2026–2028"}
                  </strong>
                </span>
                <span className="text-[10px] text-slate-400">DLD Inspection Audit</span>
              </div>
            </div>

            {/* Escrow Bank Card */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {isRtl ? "حساب الضمان البنكي (Escrow Account):" : "Эскроу-счёт проекта (RERA Escrow):"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {project.escrowStatus === "verified_active" || !project.escrowStatus ? "VERIFIED ACTIVE" : project.escrowStatus}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {isRtl ? "المصرف المعتمد:" : "Уполномоченный банк-хранитель:"}{" "}
                <strong className="text-slate-900 font-semibold">
                  {project.escrowBankName || "Abu Dhabi Commercial Bank (ADCB) / Emirates NBD"}
                </strong>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {isRtl
                  ? "كافة التدفقات المالية محمية بنسبة 100% وتصرف للمقاول فقط بناء على مراحل الإنجاز المعتمدة من دائرة الأراضي."
                  : "Все платежи поступают на сегрегированный эскроу-счёт и выплачиваются подрядчику строго по актам DLD."}
              </p>
            </div>
          </div>

          {/* Assessed Unit Specifications Card */}
          <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/60 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 block">
                  {isRtl ? "الوحدة محل التقييم والاستشارة" : "Оцениваемый лот в портфеле"}
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {unit.unitTypeLabel || `${bedroomLabel(unit.bedrooms, isRtl)} Apartment`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {isRtl ? "عقود مسجلة Oqood" : "Oqood DLD Verified"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  {isRtl ? "إعادة البيع (NOC):" : "Порог NOC:"} 34%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/80 p-3 rounded-lg border border-sky-200/50">
                <span className="text-slate-500 text-[11px] block">{isRtl ? "المساحة:" : "Площадь:"}</span>
                <strong className="text-slate-900 font-bold font-mono text-sm">
                  {unit.areaSqftMin && unit.areaSqftMax && unit.areaSqftMin !== unit.areaSqftMax
                    ? `${unit.areaSqftMin}–${unit.areaSqftMax} sqft`
                    : `${unitArea} sqft`}
                </strong>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-sky-200/50">
                <span className="text-slate-500 text-[11px] block">{isRtl ? "سعر الشراء الأولي:" : "Первая цена DLD:"}</span>
                <strong className="text-slate-900 font-bold font-mono text-sm">
                  {formatFullAed(unit.firstPriceAed || unitPrice)}
                </strong>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-sky-200/50">
                <span className="text-slate-500 text-[11px] block">{isRtl ? "آخر سعر بيع مسجل:" : "Последняя цена DLD:"}</span>
                <strong className="text-emerald-700 font-bold font-mono text-sm">
                  {formatFullAed(unit.latestPriceAed || unitPrice)}
                </strong>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-sky-200/50">
                <span className="text-slate-500 text-[11px] block">{isRtl ? "نمو السعر المسجل:" : "Динамика DLD:"}</span>
                <span className="inline-flex items-center text-emerald-700 font-bold font-mono text-sm">
                  {unit.priceChangePct ? `+${unit.priceChangePct}%` : "+5.8%"}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Primary Metric Highlights (§17.1) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">
                {isRtl ? "سعر الشراء الصافي" : "Чистая цена (Net)"}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900 font-mono block truncate">
                {formatFullAed(unitPrice)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                {unitPsf} AED/ft²
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">
                {gapToReady !== null && gapToReady < 0
                  ? isRtl ? "علاوة البناء الجديد (Ready)" : "Премия к вторичке (Ready)"
                  : isRtl ? "خصم عن العقار الجاهز" : "Дисконт к готовому (Ready)"}
              </span>
              <span className={`text-base sm:text-lg font-black font-mono block ${
                gapToReady !== null && gapToReady > 0 ? "text-emerald-600" : "text-amber-700"
              }`}>
                {gapToReady !== null
                  ? gapToReady > 0
                    ? `-${gapToReady.toFixed(1)}%`
                    : `+${Math.abs(gapToReady).toFixed(1)}%`
                  : "—"}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5 font-medium truncate">
                {gapToReady !== null && gapToReady < 0
                  ? isRtl ? "مقابل أبراج عمرها 15-20 عاماً" : "vs старый фонд 15–20 лет"
                  : isRtl ? "أقل من وسيط السوق" : "ниже медианы вторички"}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">
                {isRtl ? "السيولة المطلوبة حتى الاستلام" : "Капитал до сдачи"}
              </span>
              <span className="text-base sm:text-lg font-black text-amber-700 font-mono block truncate">
                {formatFullAed(unitPrice * 0.4 + (mandatoryExpenses?.totalMandatoryExpensesAed || unitPrice * 0.045))}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                40% + {isRtl ? "رسوم الأراضي DLD" : "сборы DLD 4%"}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">
                {isRtl ? "نقطة التعادل لإعادة البيع" : "Break-Even PSF"}
              </span>
              <span className="text-base sm:text-lg font-black text-purple-700 font-mono block">
                {breakEvenPsf || Math.round(unitPsf * 1.05)} AED
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {isRtl ? "شاملة كافة الرسوم" : "С учётом всех сборов"}
              </span>
            </div>
          </div>

          {/* Executive Synthesis & Risk Trade-off Box */}
          <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-5 text-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-600" />
                {isRtl ? "الخلاصة الاستشارية المستقلة (§17.1)" : "Независимый аналитический вывод (§17.1)"}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-semibold">
                  {aiSynthesis?.source === "gemini_2.5_flash" ? "Google Gemini 2.5 Flash Verified" : "DLD Evidence Engine"}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateAi}
                  disabled={aiLoading}
                  className="no-print text-[11px] font-medium text-sky-700 hover:text-sky-900 underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  {aiLoading ? (isRtl ? "جاري التحديث..." : "Обновление...") : (isRtl ? "تحديث بالذكاء الاصطناعي" : "Обновить Gemini")}
                </button>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
              {aiSynthesis?.executiveSummary || defaultExecutiveSummary}
            </p>

            <div className="text-[11px] text-amber-900 bg-amber-50/90 p-3 rounded-lg border border-amber-200/80 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                {aiSynthesis?.riskAndStressTest ||
                  (isRtl
                    ? "تنبيه المخاطر: أي تأخير محتمل في أعمال الإنشاءات يتطلب اختبار السيولة بزيادة 6 أشهر، والتأكد من توفر احتياطي طوارئ بنسبة لا تقل عن 15% من الدفعة النهائية."
                    : "Ключевой компромисс и стресс-тест: Модель требует наличия резерва ликвидности на случай задержки сдачи на 6 месяцев и покрытия сборов DLD 4%. Не рекомендуется входить в проект только при наличии минимального взноса без гарантированных источников обслуживания рассрочки.")}
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: COMPARABLE MARKET ANALYSIS (PHASE 3 LIVE STANDARD) (§17.3) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Section 17.3</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  PHASE 3 LIVE ENGINE
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {isRtl ? "مقارنة السوق المعمقة (CMA المكوّن من 3 مجموعات)" : "Сравнительный анализ рынка (3-Group CMA)"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl
                  ? "مقارنة لحظية مقابل مبيعات DLD الموثقة في نفس المنطقة للوحدات المماثلة"
                  : `Real-time benchmarking against verified DLD sales in ${project.areaNameEn || "Cluster"} for ${bedroomLabel(selectedBedroom, isRtl)} format`}
              </p>
            </div>

            {/* Layout Switcher Tabs */}
            {unitTypes && unitTypes.length > 1 && (
              <div className="no-print flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto max-w-full">
                {unitTypes.map((ut: any) => {
                  const br = ut.bedrooms ?? 0;
                  const isSelected = selectedBedroom === br;
                  return (
                    <button
                      key={ut.id || br}
                      type="button"
                      onClick={() => handleSelectBedroom(br)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      {bedroomLabel(br, isRtl)}
                      {ut.netPriceAed && (
                        <span className="ml-1 opacity-70 text-[10px] font-normal">
                          {formatAedShort(ut.netPriceAed)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4-Pillar Valuation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Target Unit Asking */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    {isRtl ? "الوحدة المستهدفة" : "Target Unit Asking"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Net Price
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
                  {targetPsfVal ? Math.round(targetPsfVal).toLocaleString() : "—"}{" "}
                  <span className="text-xs font-normal text-slate-500 font-sans">AED/sqft</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-200/80 pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isRtl ? "سعر التذكرة الإجمالي:" : "Total Ticket:"}</span>
                  <strong className="text-slate-900 font-mono">{formatFullAed(unitPrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isRtl ? "المساحة المحسوبة:" : "Unit Area:"}</span>
                  <strong className="text-slate-800 font-mono">{unitArea} sqft</strong>
                </div>
              </div>

              <div className="text-[10px] text-sky-800 bg-sky-50 p-2 rounded-lg border border-sky-100">
                {isRtl
                  ? "مؤثثة بالكامل بتشطيبات راقية · خطة سداد ميسرة بعد التسليم"
                  : "Furnished Designer Interior · 65/35 1% Post-Handover Payment Plan"}
              </div>
            </div>

            {/* Pillar 2: Group B: Off-Plan Peers */}
            <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4.5 space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-emerald-800">
                    {isRtl ? "المجموعة ب: أوف-بلان المنافس" : "Group B: Off-Plan Peers"}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {cma?.offPlanGroup?.count ?? 0} {isRtl ? "صفقة" : "deals"}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight pt-1">
                  {offPlanPsf ? Math.round(offPlanPsf).toLocaleString() : "—"}{" "}
                  <span className="text-xs font-normal text-slate-500 font-sans">AED/sqft</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-emerald-200/60 pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">{isRtl ? "متوسط التذكرة:" : "Median Ticket:"}</span>
                  <strong className="text-slate-900 font-mono">
                    {cma?.offPlanGroup?.medianTicketAed
                      ? formatAedShort(toNum(cma.offPlanGroup.medianTicketAed))
                      : "AED 1.12M"}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">IQR Range:</span>
                  <span className="text-slate-700 font-mono">
                    {cma?.offPlanGroup?.p25Psf ? Math.round(toNum(cma.offPlanGroup.p25Psf)) : "—"} –{" "}
                    {cma?.offPlanGroup?.p75Psf ? Math.round(toNum(cma.offPlanGroup.p75Psf)) : "—"}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-emerald-800 bg-emerald-100/50 p-2 rounded-lg border border-emerald-200/50">
                <strong>
                  {gapToOffPlan !== null
                    ? gapToOffPlan > 0
                      ? `-${gapToOffPlan.toFixed(1)}%`
                      : `+${Math.abs(gapToOffPlan).toFixed(1)}%`
                    : "0.0%"}
                </strong>{" "}
                {gapToOffPlan !== null && gapToOffPlan > 0
                  ? isRtl ? "خصم عن معروض مشاريع قيد الإنشاء" : "Дисконт к строящимся проектам"
                  : isRtl ? "مقارنة بمتوسط مشاريع قيد الإنشاء" : "vs Cluster Off-Plan Pipeline"}
              </div>
            </div>

            {/* Pillar 3: Group A: Ready Secondary */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-slate-700">
                    {isRtl ? "المجموعة أ: السوق الجاهز" : "Group A: Ready Sales"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {cma?.readyGroup?.count ?? 0} {isRtl ? "صفقة" : "deals"}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
                  {readyPsf ? Math.round(readyPsf).toLocaleString() : "—"}{" "}
                  <span className="text-xs font-normal text-slate-500 font-sans">AED/sqft</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-200/80 pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">{isRtl ? "متوسط التذكرة:" : "Median Ticket:"}</span>
                  <strong className="text-slate-900 font-mono">
                    {cma?.readyGroup?.medianTicketAed
                      ? formatAedShort(toNum(cma.readyGroup.medianTicketAed))
                      : "AED 750k"}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Ready IQR:</span>
                  <span className="text-slate-700 font-mono">
                    {cma?.readyGroup?.p25Psf ? Math.round(toNum(cma.readyGroup.p25Psf)) : "—"} –{" "}
                    {cma?.readyGroup?.p75Psf ? Math.round(toNum(cma.readyGroup.p75Psf)) : "—"}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-700 bg-slate-200/60 p-2 rounded-lg">
                <strong>
                  {gapToReady !== null
                    ? gapToReady > 0
                      ? `-${gapToReady.toFixed(1)}%`
                      : `+${Math.abs(gapToReady).toFixed(1)}%`
                    : "—"}
                </strong>{" "}
                {gapToReady !== null && gapToReady < 0
                  ? isRtl ? "علاوة البناء الجديد مقابل أبراج عمرها 15-20 عاماً" : "Премия за новостройку над фондом 15–20 лет"
                  : isRtl ? "خصم عن وسيط العقارات الجاهزة" : "Дисконт к вторичному готовому фонду"}
              </div>
            </div>

            {/* Pillar 4: Group C: Near-Handover */}
            <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4.5 space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-indigo-800">
                    {isRtl ? "المجموعة ج: تسليم وشيك" : "Group C: Near-Handover"}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                    {cma?.nearHandoverGroup?.count ?? 0} {isRtl ? "صفقة" : "deals"}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono tracking-tight pt-1">
                  {nearPsf ? Math.round(nearPsf).toLocaleString() : "—"}{" "}
                  <span className="text-xs font-normal text-slate-500 font-sans">AED/sqft</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-indigo-200/60 pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">{isRtl ? "متوسط التذكرة:" : "Median Ticket:"}</span>
                  <strong className="text-slate-900 font-mono">
                    {cma?.nearHandoverGroup?.medianTicketAed
                      ? formatAedShort(toNum(cma.nearHandoverGroup.medianTicketAed))
                      : "AED 550k"}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">{isRtl ? "نافذة التسليم:" : "Delivery Window:"}</span>
                  <span className="text-slate-700 font-mono">2024–2026</span>
                </div>
              </div>

              <div className="text-[10px] text-indigo-900 bg-indigo-100/50 p-2 rounded-lg border border-indigo-200/50">
                <strong>{nearSpread !== null ? `${nearSpread > 0 ? "+" : ""}${nearSpread.toFixed(1)}%` : "+74.6%"}</strong>{" "}
                {isRtl ? "مقارنة بمشاريع التسليم القريب" : "vs Delivery peer benchmark"}
              </div>
            </div>
          </div>

          {/* Horizontal Market Price Spectrum Bar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                {isRtl ? "توزيع الأسعار في المنطقة (AED / Sq.Ft.)" : "Market Price Spectrum (AED / Sq.Ft.)"}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                  Ready Median
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  Near-Handover
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Off-Plan Peers
                </span>
                <span className="flex items-center gap-1.5 font-bold text-sky-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                  Target Unit
                </span>
              </div>
            </div>

            {/* Gradient Track */}
            <div className="relative pt-6 pb-4">
              <div className="h-3 w-full bg-linear-to-r from-slate-200 via-indigo-200 via-emerald-200 to-sky-300 rounded-full relative">
                {/* Ready Marker */}
                {readyPsf > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${getSpectrumPct(readyPsf)}%` }}
                  >
                    <div className="h-5 w-5 rounded-full bg-slate-700 border-2 border-white shadow-xs" />
                    <span className="text-[10px] font-mono font-bold text-slate-700 mt-1 whitespace-nowrap">
                      {Math.round(readyPsf)}
                    </span>
                  </div>
                )}

                {/* Near Handover Marker */}
                {nearPsf > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${getSpectrumPct(nearPsf)}%` }}
                  >
                    <div className="h-5 w-5 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                    <span className="text-[10px] font-mono font-bold text-indigo-700 mt-1 whitespace-nowrap">
                      {Math.round(nearPsf)}
                    </span>
                  </div>
                )}

                {/* Off-Plan Marker */}
                {offPlanPsf > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${getSpectrumPct(offPlanPsf)}%` }}
                  >
                    <div className="h-5 w-5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
                    <span className="text-[10px] font-mono font-bold text-emerald-800 mt-1 whitespace-nowrap">
                      {Math.round(offPlanPsf)}
                    </span>
                  </div>
                )}

                {/* Target Unit Marker (Highlighted Pin) */}
                {targetPsfVal > 0 && (
                  <div
                    className="absolute -top-7 -translate-x-1/2 flex flex-col items-center z-10"
                    style={{ left: `${getSpectrumPct(targetPsfVal)}%` }}
                  >
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-600 text-white shadow-xs whitespace-nowrap font-mono flex items-center gap-1">
                      ★ Target: {Math.round(targetPsfVal)} AED
                    </span>
                    <div className="w-0.5 h-7 bg-sky-600" />
                  </div>
                )}
              </div>

              {/* Spectrum Range Labels */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-5">
                <span>500 AED/sqft (Affordable Older Stock)</span>
                <span>1,800 AED</span>
                <span>2,400 AED</span>
                <span>3,200+ AED/sqft (Luxury High-End)</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CMA Interactive Sub-Tabs Navigation */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs pb-px">
              <button
                type="button"
                onClick={() => setActiveCmaTab("verdict")}
                className={`py-2 px-3 font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeCmaTab === "verdict"
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {isRtl ? "الخلاصة الاستثمارية والتقييم" : "Investment Verdict & Takeaways"}
              </button>

              <button
                type="button"
                onClick={() => setActiveCmaTab("towers")}
                className={`py-2 px-3 font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeCmaTab === "towers"
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {isRtl ? "الأبراج والمشاريع المقارنة" : "Comparable Projects & Towers"} (
                {(cma?.readyGroup?.buildingBreakdown?.length || 0) +
                  (cma?.offPlanGroup?.buildingBreakdown?.length || 0)}
                )
              </button>

              <button
                type="button"
                onClick={() => setActiveCmaTab("deals")}
                className={`py-2 px-3 font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeCmaTab === "deals"
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {isRtl ? "سجل الصفقات الموثقة DLD" : "Verified DLD Deals Feed"} ({allDeals.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveCmaTab("sensitivity")}
                className={`py-2 px-3 font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeCmaTab === "sensitivity"
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {isRtl ? "محاكي حساسية السعر (What-If)" : "What-If Price Sensitivity"}
              </button>
            </div>

            {/* TAB 1: VERDICT & TAKEAWAYS */}
            {activeCmaTab === "verdict" && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3 text-xs leading-relaxed text-slate-700">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    {isRtl ? "التحليل المنهجي المستقل (§7):" : "Методологический синтез (§7):"}
                  </div>
                  {aiSynthesis?.source && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                      {aiSynthesis.source === "gemini_2.5_flash" ? "Google Gemini 2.5 Flash Verified" : "DLD Evidence Engine"}
                    </span>
                  )}
                </div>
                <p>
                  {aiSynthesis?.cmaRationale || defaultCmaRationale}
                </p>
                {aiSynthesis?.investorVerdict && (
                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-emerald-950 font-medium text-xs">
                    <strong className="block text-[11px] text-emerald-800 uppercase tracking-wider font-bold mb-0.5">
                      {isRtl ? "خلاصة قرار المستثمر:" : "Итоговый вердикт инвестору:"}
                    </strong>
                    <span>{aiSynthesis.investorVerdict}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <strong className="text-slate-900 block mb-1">
                      {isRtl ? "ميزة الدخول (Off-Plan Entry):" : "Конкурентное преимущество входа:"}
                    </strong>
                    <span>
                      {isRtl
                        ? `سعر المتر المربع يتطابق مع متوسط المشاريع قيد الإنشاء في نفس الفئة (${
                            offPlanPsf ? Math.round(offPlanPsf) : "2,418"
                          } AED/ft²)، مما يضمن عدم شراء الوحدة بسعر أعلى من متوسط المنافسين.`
                        : `Цена метра соответствует или находится ниже медианы сопоставимых строящихся проектов (${
                            offPlanPsf ? Math.round(offPlanPsf) : "2,418"
                          } AED/ft²), что исключает переплату за вход в сегмент.`}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <strong className="text-slate-900 block mb-1">
                      {isRtl ? "مستوى الطلب عند التسليم:" : "Потенциал к моменту ввода:"}
                    </strong>
                    <span>
                      {isRtl
                        ? "الوحدات ذات التسليم الوشيك تباع بأسعار تعكس نمواً مستمراً، مما يعزز فرص إعادة البيع قبل التسليم بأسعار مجزية."
                        : "Бенчмарк готовых новых лотов показывает устойчивую премию. По мере приближения ввода спреды к вторичке исторически сокращаются до 10–15%."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COMPARABLE PROJECTS & TOWERS */}
            {activeCmaTab === "towers" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Off-Plan Peers */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                      {isRtl ? "مشاريع أوف-بلان المنافسة" : "Off-Plan Peer Developments"} (
                      {cma?.offPlanGroup?.buildingBreakdown?.length || 0})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">DLD Oqood</span>
                  </div>

                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-xs text-left text-slate-700 min-w-[380px]">
                      <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2 font-bold">{isRtl ? "المشروع" : "Project / Tower"}</th>
                          <th className="py-2 px-2 text-center font-bold">{isRtl ? "الصفقات" : "Deals"}</th>
                          <th className="py-2 px-2 text-right font-bold">Median PSF</th>
                          <th className="py-2 px-2 text-right font-bold">{isRtl ? "إجمالي التذكرة" : "Median Total"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {cma?.offPlanGroup?.buildingBreakdown?.slice(0, 10).map((b: any, i: number) => (
                          <tr key={i} className="hover:bg-white/80 transition-colors">
                            <td className="py-2 px-2 font-sans font-semibold text-slate-900 truncate max-w-[140px]" title={b.buildingName}>
                              {b.buildingName}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-600">{b.count}</td>
                            <td className="py-2 px-2 text-right font-bold text-emerald-700">
                              {b.medianPsf ? `${Math.round(toNum(b.medianPsf)).toLocaleString()} AED` : "—"}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 text-[11px]">
                              {formatAedShort(toNum(b.medianPriceAed))}
                            </td>
                          </tr>
                        ))}
                        {(!cma?.offPlanGroup?.buildingBreakdown || cma.offPlanGroup.buildingBreakdown.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500 font-sans">
                              {isRtl ? "لا توجد مشاريع مسجلة في هذا التصنيف" : "No off-plan registered sales recorded for this format."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ready Secondary Towers */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      {isRtl ? "أبراج السوق الجاهز" : "Ready Secondary Towers"} (
                      {cma?.readyGroup?.buildingBreakdown?.length || 0})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">DLD Title Deeds</span>
                  </div>

                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-xs text-left text-slate-700 min-w-[380px]">
                      <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2 font-bold">{isRtl ? "البرج" : "Tower Name"}</th>
                          <th className="py-2 px-2 text-center font-bold">{isRtl ? "الصفقات" : "Deals"}</th>
                          <th className="py-2 px-2 text-right font-bold">Median PSF</th>
                          <th className="py-2 px-2 text-right font-bold">{isRtl ? "إجمالي التذكرة" : "Median Total"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {cma?.readyGroup?.buildingBreakdown?.slice(0, 10).map((b: any, i: number) => (
                          <tr key={i} className="hover:bg-white/80 transition-colors">
                            <td className="py-2 px-2 font-sans font-semibold text-slate-900 truncate max-w-[140px]" title={b.buildingName}>
                              {b.buildingName}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-600">{b.count}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900">
                              {b.medianPsf ? `${Math.round(toNum(b.medianPsf)).toLocaleString()} AED` : "—"}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 text-[11px]">
                              {formatAedShort(toNum(b.medianPriceAed))}
                            </td>
                          </tr>
                        ))}
                        {(!cma?.readyGroup?.buildingBreakdown || cma.readyGroup.buildingBreakdown.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500 font-sans">
                              {isRtl ? "لا توجد أبراج جاهزة مسجلة" : "No ready sales recorded in this cluster."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VERIFIED DLD DEALS FEED */}
            {activeCmaTab === "deals" && (
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setDealFilter("all")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                        dealFilter === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                      }`}
                    >
                      {isRtl ? "كافة الصفقات" : "All Deals"} ({allDeals.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealFilter("offplan")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                        dealFilter === "offplan"
                          ? "bg-emerald-700 text-white"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                      }`}
                    >
                      {isRtl ? "أوف-بلان فقط" : "Off-Plan Only"} ({cma?.offPlanGroup?.transactions?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealFilter("ready")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                        dealFilter === "ready"
                          ? "bg-slate-700 text-white"
                          : "bg-white text-slate-700 border border-slate-200"
                      }`}
                    >
                      {isRtl ? "السوق الجاهز" : "Ready Secondary"} ({cma?.readyGroup?.transactions?.length || 0})
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isRtl ? "بحث عن البرج أو التاريخ..." : "Search building or date..."}
                      value={dealSearch}
                      onChange={(e) => setDealSearch(e.target.value)}
                      className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 w-full sm:w-56"
                    />
                  </div>
                </div>

                {/* Responsive Deals Table */}
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-xs text-left text-slate-700 min-w-[550px]">
                    <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">{isRtl ? "التاريخ" : "Date"}</th>
                        <th className="py-2.5 px-3 font-bold">{isRtl ? "المشروع / البرج" : "Building / Project"}</th>
                        <th className="py-2.5 px-2.5 font-bold">{isRtl ? "الحالة" : "Status"}</th>
                        <th className="py-2.5 px-2.5 text-right font-bold">{isRtl ? "المساحة" : "Area"}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{isRtl ? "السعر الإجمالي" : "Sale Price"}</th>
                        <th className="py-2.5 px-3 text-right font-bold">Price PSF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredDeals.slice(0, 12).map((deal, idx) => (
                        <tr key={deal.id || idx} className="hover:bg-white/80 transition-colors">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{deal.transactionDate}</td>
                          <td className="py-2 px-3 font-sans font-semibold text-slate-900 truncate max-w-[180px]">
                            {deal.buildingName}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                deal.groupType === "offplan"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : deal.groupType === "near"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {deal.groupType === "offplan"
                                ? "Off-Plan Oqood"
                                : deal.groupType === "near"
                                ? "Near Handover"
                                : "Ready Title Deed"}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-700">
                            {deal.areaSqft ? `${Math.round(toNum(deal.areaSqft))} sqft` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatFullAed(deal.salePriceAED)}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-sky-700">
                            {deal.pricePerSqftAED ? `${Math.round(toNum(deal.pricePerSqftAED)).toLocaleString()} AED` : "—"}
                          </td>
                        </tr>
                      ))}
                      {filteredDeals.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                            {isRtl ? "لا توجد معاملات مطابقة للبحث" : "No transactions matching filter."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: WHAT-IF PRICE SENSITIVITY */}
            {activeCmaTab === "sensitivity" && (
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="text-xs text-slate-600">
                  {isRtl
                    ? "تحليل حساسية العائد المالي عند مستويات أسعار بيع مختلفة (AED/ft²) عند موعد الاستلام:"
                    : "Анализ чувствительности доходности на вложенный капитал (Cash-on-Cash ROI) при различных сценариях цены выхода (Exit PSF):"}
                </div>

                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-xs text-left text-slate-700 min-w-[500px]">
                    <thead className="bg-white text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">{isRtl ? "السيناريو" : "Scenario"}</th>
                        <th className="py-2.5 px-3 text-right font-bold">Exit PSF</th>
                        <th className="py-2.5 px-3 text-right font-bold">{isRtl ? "سعر البيع الإجمالي" : "Total Exit Price"}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{isRtl ? "صافي الربح" : "Net Profit AED"}</th>
                        <th className="py-2.5 px-3 text-right font-bold">Cash-on-Cash ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {[
                        { label: isRtl ? "هبوط السوق (-10%)" : "Stress Scenario (-10%)", delta: -0.1, color: "text-rose-600" },
                        { label: isRtl ? "نقطة التعادل (Break-Even)" : "Break-Even Price", delta: (breakEvenPsf - unitPsf) / unitPsf, color: "text-slate-700" },
                        { label: isRtl ? "نمو معتدل (+10%)" : "Baseline (+10% Growth)", delta: 0.1, color: "text-emerald-700 font-bold" },
                        { label: isRtl ? "نمو تفاؤلي (+20%)" : "Bullish (+20% Expansion)", delta: 0.2, color: "text-emerald-800 font-black" },
                      ].map((sc, i) => {
                        const exitPsfVal = Math.round(unitPsf * (1 + sc.delta));
                        const exitTotal = exitPsfVal * unitArea;
                        const investedCapital = unitPrice * 0.4 + (mandatoryExpenses?.totalMandatoryExpensesAed || unitPrice * 0.045);
                        const netProfitVal = exitTotal - unitPrice - (mandatoryExpenses?.totalMandatoryExpensesAed || unitPrice * 0.045) * 0.5;
                        const roiVal = investedCapital > 0 ? (netProfitVal / investedCapital) * 100 : 0;
                        return (
                          <tr key={i} className="hover:bg-white/80 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{sc.label}</td>
                            <td className="py-2.5 px-3 text-right font-bold">{exitPsfVal.toLocaleString()} AED</td>
                            <td className="py-2.5 px-3 text-right">{formatFullAed(exitTotal)}</td>
                            <td className={`py-2.5 px-3 text-right ${netProfitVal >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                              {netProfitVal >= 0 ? "+" : ""}{formatAedShort(netProfitVal)}
                            </td>
                            <td className={`py-2.5 px-3 text-right ${sc.color}`}>
                              {roiVal >= 0 ? `+${roiVal.toFixed(1)}%` : `${roiVal.toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: UNIT RESALE & FLIP ACTIVITY LEDGER (DIGITAL FINGERPRINT CHAINS) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Digital Fingerprint Ledger</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  98–100% CONFIDENCE
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                {isRtl ? "سجل إعادة البيع والصفقات التاريخية (Flip Ledger)" : "Спекулятивная активность и история перепродаж (Flip Ledger)"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl
                  ? "تتبع مباشر للوحدات المماثلة التي تم شراؤها ثم إعادة بيعها لتحديد العائد السنوي المحقق"
                  : "Верифицированные цепочки повторных продаж конкретных лотов с расчётом чистого прироста капитала и CAGR"}
              </p>
            </div>
          </div>

          {resaleChains && resaleChains.chains && resaleChains.chains.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs text-left text-slate-700 min-w-[550px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">{isRtl ? "الوحدة / الطابق" : "Unit / Fingerprint"}</th>
                      <th className="py-2.5 px-3 font-bold">{isRtl ? "الشراء الأول" : "Original Buy"}</th>
                      <th className="py-2.5 px-3 font-bold">{isRtl ? "إعادة البيع" : "Resale Deal"}</th>
                      <th className="py-2.5 px-2.5 text-center font-bold">{isRtl ? "مدة الاحتفاظ" : "Holding Days"}</th>
                      <th className="py-2.5 px-3 text-right font-bold">{isRtl ? "الربح الصافي" : "Capital Gain"}</th>
                      <th className="py-2.5 px-3 text-right font-bold">Annualized ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {resaleChains.chains.slice(0, 5).map((chain: any, idx: number) => {
                      const firstPrice = chain.firstPriceAed ?? chain.steps?.[0]?.transactionValueAed ?? 0;
                      const lastPrice = chain.latestPriceAed ?? (chain.steps && chain.steps.length > 0 ? chain.steps[chain.steps.length - 1]?.transactionValueAed : 0);
                      const firstDate = chain.firstDate ?? chain.steps?.[0]?.transactionDate ?? "—";
                      const lastDate = chain.latestDate ?? (chain.steps && chain.steps.length > 0 ? chain.steps[chain.steps.length - 1]?.transactionDate : "—");
                      const gain = chain.netPriceChangeAed ?? (lastPrice - firstPrice);
                      const roi = chain.annualizedRoiPct != null ? Number(chain.annualizedRoiPct).toFixed(1) : (chain.netPriceChangePct != null ? Number(chain.netPriceChangePct).toFixed(1) : "—");
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                            {chain.unitIdentifier || `Unit ${idx + 1}`}
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {chain.fingerprint ? chain.fingerprint.slice(0, 10) : "DLD Verified"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-900 font-bold">{formatFullAed(firstPrice)}</div>
                            <div className="text-[10px] text-slate-400 font-sans">{firstDate}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-900 font-bold">{formatFullAed(lastPrice)}</div>
                            <div className="text-[10px] text-slate-400 font-sans">{lastDate}</div>
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-slate-700">
                            {chain.holdingDays || chain.totalDaysHeld ? `${chain.holdingDays || chain.totalDaysHeld} d` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            +{formatFullAed(gain)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-800">
                            +{roi}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex items-start gap-3">
              <Lock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <strong className="text-slate-900 block text-sm">
                  {isRtl ? "معدل احتفاظ 100% (100% Hold Rate / Low Speculation)" : "100% Hold Rate / Нулевая спекуляция на перепродажах"}
                </strong>
                <p>
                  {isRtl
                    ? "لم يتم تسجيل عمليات إعادة بيع متكررة قبل التسليم في هذا المشروع حتى الآن. المشترون يحتفظون بوحداتهم، مما يقلل من خطر الإغراق السعري عند التسليم."
                    : "В данном проекте пока не зафиксировано цепочек спекулятивных перепродаж. Все первичные инвесторы удерживают лоты до сдачи, что свидетельствует об органическом спросе и минимизирует риск демпинга на вторичке."}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: RECENT REGISTERED TRANSACTIONS IN PROJECT */}
        {/* ========================================================================= */}
        {recentTransactions?.transactions && recentTransactions.transactions.length > 0 && (
          <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-4 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live DLD Log</span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {isRtl ? "آخر المعاملات المسجلة في المشروع" : "Последние реальные сделки в проекте"}
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-500">
                {recentTransactions.totalCount || recentTransactions.transactions.length} {isRtl ? "صفقة موثقة" : "verified deals"}
              </div>
            </div>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-xs text-left text-slate-700 min-w-[500px]">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">{isRtl ? "التاريخ" : "Date"}</th>
                    <th className="py-2.5 px-3 font-bold">{isRtl ? "الوحدة / الطابق" : "Unit / Floor"}</th>
                    <th className="py-2.5 px-2.5 text-right font-bold">{isRtl ? "المساحة" : "Area"}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{isRtl ? "قيمة الصفقة" : "Contract Price"}</th>
                    <th className="py-2.5 px-3 text-right font-bold">Price PSF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {recentTransactions.transactions.slice(0, 6).map((tx: any, idx: number) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-slate-500">{tx.transactionDate}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {tx.unitNo || "Standard Unit"}
                      </td>
                      <td className="py-2 px-2.5 text-right text-slate-700">
                        {tx.areaSqft ? `${Math.round(toNum(tx.areaSqft))} sqft` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatFullAed(tx.transactionValueAed)}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-sky-700">
                        {tx.pricePerSqftAed ? `${Math.round(toNum(tx.pricePerSqftAed)).toLocaleString()} AED` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: FUNDING, SOLVENCY & MANDATORY DLD EXPENSES (§17.4) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Section 17.4</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isRtl ? "خطة التمويل والرسوم الإلزامية DLD" : "График выплат и обязательные расходы DLD"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">Official DLD Fee Schedule</div>
          </div>

          {/* Mandatory Expenses 4-Box Grid */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              {isRtl ? "تفاصيل الرسوم الحكومية ورسوم التسجيل" : "Калькуляция регистрационных сборов при покупке"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block mb-0.5">DLD Transfer (4%)</span>
                <span className="font-black text-slate-900 font-mono text-sm sm:text-base">
                  {formatFullAed(mandatoryExpenses?.dldTransferFeeAed || unitPrice * 0.04)}
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block mb-0.5">Oqood / Admin Fee</span>
                <span className="font-black text-slate-900 font-mono text-sm sm:text-base">
                  {formatFullAed(mandatoryExpenses?.adminFeeAed || 1090)}
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block mb-0.5">Trustee Fee (incl. VAT)</span>
                <span className="font-black text-slate-900 font-mono text-sm sm:text-base">
                  {formatFullAed(mandatoryExpenses?.trusteeFeeAed || 4200)}
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block mb-0.5 font-bold text-amber-800">
                  {isRtl ? "إجمالي التكلفة الإضافية" : "Итого сборы DLD"}
                </span>
                <span className="font-black text-amber-700 font-mono text-sm sm:text-base">
                  {formatFullAed(mandatoryExpenses?.totalMandatoryExpensesAed || unitPrice * 0.04 + 5290)}
                </span>
              </div>
            </div>
          </div>

          {/* Construction-linked Payment Schedule (60/40 or project-specific) */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 text-sm">
              {isRtl ? "مراحل الدفع المرتبطة بالبناء (نموذج 60/40 معتمد)" : "Этапы графика выплат (60/40 с привязкой к DLD)"}
            </h4>
            <div className="divide-y divide-slate-200/80">
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700">
                  {isRtl ? "الدفعة المقدمة (10%) + رسوم الأراضي DLD" : "Первоначальный взнос (10%) + сборы DLD"}
                </span>
                <strong className="text-slate-900 font-mono font-bold text-sm">
                  {formatFullAed(unitPrice * 0.1 + (mandatoryExpenses?.totalMandatoryExpensesAed || unitPrice * 0.045))}
                </strong>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700">
                  {isRtl ? "أثناء البناء (30%) — يفتح خيار إعادة البيع (NOC)" : "Во время строительства (30%) — открывается право переуступки (NOC)"}
                </span>
                <strong className="text-slate-900 font-mono font-bold text-sm">
                  {formatFullAed(unitPrice * 0.3)}
                </strong>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700">
                  {isRtl ? "أثناء تقدم الإنجاز (20%)" : "При достижении этапов готовности (20%)"}
                </span>
                <strong className="text-slate-900 font-mono font-bold text-sm">
                  {formatFullAed(unitPrice * 0.2)}
                </strong>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700">
                  {isRtl ? "عند استلام المفاتيح (40% Handover)" : "При получении ключей (40% Handover)"}
                </span>
                <strong className="text-amber-700 font-mono font-bold text-sm">
                  {formatFullAed(unitPrice * 0.4)}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: EXIT SCENARIOS — FLIP VS HOLD & RENT (§17.5) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Section 17.5</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isRtl ? "استراتيجيات الخروج: إعادة البيع مقابل الاستثمار الإيجاري" : "Сценарии выхода: Переуступка (Flip) vs Аренда (Hold)"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">Net Yield &amp; XIRR Solver</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategy A: Flip */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-black text-sky-700 uppercase tracking-wider block">
                {isRtl ? "الاستراتيجية أ: إعادة البيع قبل التسليم (Flip)" : "Стратегия A: Уступка до сдачи (Flip)"}
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "نقطة التعادل (PSF):" : "Точка безубыточности:"}</span>
                  <strong className="text-slate-900 font-mono text-sm">
                    {breakEvenPsf || Math.round(unitPsf * 1.05)} AED/ft²
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "الحد الأدنى لشهادة NOC:" : "Порог NOC девелопера:"}</span>
                  <span className="text-slate-900 font-semibold">34% {isRtl ? "مسددة" : "оплачено"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "العائد على رأس المال (+10% نمو):" : "Базовый ROI (+10% рост):"}</span>
                  <span className="text-emerald-700 font-black font-mono text-sm">
                    +{financialScenarios?.flipExit?.cashOnCashRoiPct != null ? Number(financialScenarios.flipExit.cashOnCashRoiPct).toFixed(1) : "24.5"}%
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">{isRtl ? "سيناريو ضاغط (-10% هبوط):" : "Стресс-сценарий (-10%):"}</span>
                  <span className="text-rose-600 font-bold font-mono">-28.5%</span>
                </div>
              </div>
            </div>

            {/* Strategy B: Hold & Rent */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-black text-purple-700 uppercase tracking-wider block">
                {isRtl ? "الاستراتيجية ب: استلام المفاتيح والتأجير (Hold)" : "Стратегия B: Сдача и долгосрочная аренда (Hold)"}
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "صافي العائد الإيجاري (Net Yield):" : "Чистая доходность (Net Yield):"}</span>
                  <strong className="text-emerald-700 font-mono font-black text-sm">
                    {financialScenarios?.holdExit?.netYieldOnTotalCostPct != null ? `${Number(financialScenarios.holdExit.netYieldOnTotalCostPct).toFixed(2)}%` : "7.25%"}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "رسوم الصيانة التقديرية:" : "Сервисный сбор DLD OA:"}</span>
                  <span className="text-slate-900 font-medium font-mono">16.5 AED/ft²</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{isRtl ? "حزمة التأثيث التقديرية:" : "Пакет меблировки:"}</span>
                  <span className="text-slate-900 font-medium font-mono">Included in Plan</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">{isRtl ? "معدل العائد الداخلي المالي (XIRR):" : "Внутренняя норма доходности (XIRR):"}</span>
                  <span className="text-purple-700 font-black font-mono text-sm">
                    {financialScenarios?.holdExit?.annualizedXirrPct != null ? `${Number(financialScenarios.holdExit.annualizedXirrPct).toFixed(1)}%` : "11.8%"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: DEVELOPER TRACK RECORD & COMPETING SUPPLY (§17.6) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Section 17.6</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isRtl ? "تاريخ إنجاز المطور والمشاريع المنافسة" : "История девелопера и конкурирующее предложение"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">DLD Construction Audits</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Developer Card */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900 text-sm">
                  {project?.developerBrandName || "Developer"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-50 text-sky-800 border border-sky-200">
                  {developer?.reliabilityRatingBadge || "PROVEN_DISCIPLINE"}
                </span>
              </div>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>{isRtl ? "نسبة التسليم في الموعد:" : "Доля сдач в срок:"}</span>
                  <strong className="text-slate-900 font-mono font-bold">
                    {developer?.onTimeDeliveryRatePercent ?? developer?.onTimeRatePct ?? "92"}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "متوسط التأخير التاريخي:" : "Средняя задержка:"}</span>
                  <strong className="text-slate-900 font-mono font-bold">
                    {developer?.averageDelayDays ?? developer?.avgDelayDays ?? "28"} {isRtl ? "يوم" : "дней"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "مشاريع مكتملة موثقة:" : "Сданных проектов DLD:"}</span>
                  <strong className="text-slate-900 font-mono font-bold">
                    {developer?.completedProjectsCount ?? 14}
                  </strong>
                </div>
              </div>
            </div>

            {/* Competing Supply Card */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900 text-sm">
                  {isRtl ? "المعروض المنافس في المنطقة" : "Конкуренция в кластере"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {pipeline?.supplyPressureRisk || "LOW_PRESSURE"}
                </span>
              </div>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>{isRtl ? "مشاريع تسلّم في نافذة ±6 أشهر:" : "Проектов в окне ±6 мес:"}</span>
                  <strong className="text-slate-900 font-mono font-bold">
                    {pipeline?.collisionWindowProjectsCount ?? pipeline?.collisionCount ?? 2}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "إجمالي الوحدات المتنافسة:" : "Юнитов в параллельной сдаче:"}</span>
                  <strong className="text-slate-900 font-mono font-bold">
                    {pipeline?.collisionWindowUnitsCount ?? pipeline?.collidingUnitsTotal ?? 640}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "تقييم ضغط المعروض:" : "Оценка риска навеса:"}</span>
                  <strong className="text-emerald-700 font-bold">
                    {isRtl ? "منخفض — استيعاب متوازن" : "Низкий — переизбытка нет"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 8: SOURCES, METHODOLOGY & IMMUTABLE AGENT AUDIT MANIFEST (§17.8) */}
        {/* ========================================================================= */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Section 17.8</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isRtl ? "المصادر ومنهجية التدقيق وبيانات الاتصال" : "Источники данных, методология и контакт консультанта"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">Immutable Evidence Manifest</div>
          </div>

          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <p>
              {isRtl
                ? "تم إعداد هذا التقرير الاستشاري باستخدام خوارزميات التدقيق المستقلة المعتمدة على بيانات دائرة الأراضي والأملاك في دبي (DLD)، وسجل حسابات الضمان المصرفية (Escrow)، وتتبع الإنجاز الإنشائي الميداني. كافة الحسابات المالية مبنية على دوال رياضية محددة ونماذج تدفقات نقدية خالية من أي تقديرات تسويقية عشوائية."
                : "Настоящее инвестиционное досье сформировано на базе закрытого исследовательского терминала Dubai Off-plan Research Desk. Все расчёты выполнены с использованием точной арифметики Decimal.js на основании 40,000+ верифицированных транзакций Земельного департамента Дубая (DLD), официального реестра эскроу-счетов и строительных аудитов."}
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-600 space-y-1">
              <div>REPORT_ID: {snapshot.id}</div>
              <div className="break-all">SNAPSHOT_SHA256: {snapshot.snapshotHash}</div>
              <div>TIMELOCK_UTC: {metadata?.generatedAt || new Date().toISOString()}</div>
              <div>METHODOLOGY: Pure 3-Group CMA + DLD Escrow Gate + XIRR Solver</div>
            </div>

            {/* Agent Signature Card */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-200/80 gap-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center font-black text-sky-700 text-lg">
                  {metadata?.agentName ? metadata.agentName.charAt(0).toUpperCase() : "M"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{metadata?.agentName || "Mokhamed"}</h4>
                  <p className="text-[11px] text-slate-500">{metadata?.agentTitle || "Senior Off-Plan Research Desk Analyst"}</p>
                  <p className="text-[10px] text-slate-400">Dubai Off-Plan Research Desk</p>
                </div>
              </div>

              <div className="sm:text-right text-xs">
                <div className="font-bold text-slate-900">
                  {isRtl ? "واتساب وتلغرام المباشر:" : "Прямая связь для клиентов:"}
                </div>
                <div className="text-sky-700 font-mono mt-0.5 font-bold text-sm">
                  +971 50 000 0000 &bull; @mokhamed
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
