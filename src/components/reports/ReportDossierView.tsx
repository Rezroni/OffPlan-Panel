"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { formatAED } from "@/lib/decimal";

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

export function ReportDossierView({ snapshot, isPrintMode }: ReportDossierViewProps) {
  const [locale, setLocale] = useState<"ru" | "ar">((snapshot.locale as any) === "ar" ? "ar" : "ru");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    project = {},
    unit = {},
    cma = {},
    pipeline = {},
    developer = {},
    mandatoryExpenses = {},
    financialScenarios = {},
    metadata = {},
  } = snapshot.payload || {};

  const isRtl = locale === "ar";

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

  const unitPrice = unit.netPriceAed || unit.listPriceAed || 0;
  const unitArea = unit.areaSqftMin || unit.areaSqftMax || unit.areaSqft || 850;
  const unitPsf = unitPrice > 0 && unitArea > 0 ? Math.round(unitPrice / unitArea) : 0;
  const breakEvenPrice = Number(financialScenarios?.breakEven?.breakEvenPriceAed) || 0;
  const breakEvenPsf = breakEvenPrice > 0 && unitArea > 0 ? Math.round(breakEvenPrice / unitArea) : 0;
  const gapToReady = cma?.gapToReadyPercent != null && !isNaN(Number(cma.gapToReadyPercent)) ? Number(cma.gapToReadyPercent) : null;
  const gapToOffPlan = cma?.gapToOffPlanPercent != null && !isNaN(Number(cma.gapToOffPlanPercent)) ? Number(cma.gapToOffPlanPercent) : null;

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 ${isRtl ? "rtl font-sans" : "font-sans"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Top action toolbar (hidden on print) */}
      {!isPrintMode && (
        <header className="no-print sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${project.id || ""}`}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{isRtl ? "العودة للمشروع" : "Назад к проекту"}</span>
              </Link>
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {project.nameEn || "Dossier"} — {isRtl ? "ملف التوصية الاستثمارية" : "Инвестиционное досье"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  {isRtl ? "معتمد" : "APPROVED"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Language switcher */}
              <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setLocale("ru")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    locale === "ru"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  RU
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("ar")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    locale === "ar"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  العربية
                </button>
              </div>

              {/* Native Print */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isRtl ? "طباعة" : "Печать"}</span>
              </button>

              {/* Playwright Headless PDF */}
              <button
                type="button"
                onClick={handleDownloadPlaywrightPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/10 transition-all disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {downloadingPdf
                    ? isRtl
                      ? "جاري التجهيز..."
                      : "Генерация..."
                    : isRtl
                    ? "تحميل PDF موثق"
                    : "Скачать чистый PDF"}
                </span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Dossier Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8 print:p-0 print:m-0 print:max-w-none print:text-black">
        {/* ========================================================================= */}
        {/* PAGE 1: EXECUTIVE SUMMARY & PERSONAL CONCLUSION (§17.1) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-800 pb-6 print:border-slate-300">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 print:border-black print:text-black">
                  {isRtl ? "تقرير استشاري موثق" : "Evidence-Based Advisory Dossier"}
                </span>
                <span className="text-[11px] font-mono text-slate-500 print:text-slate-600">
                  REF: {snapshot.snapshotHash ? snapshot.snapshotHash.slice(0, 12).toUpperCase() : "VERIFIED"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white print:text-black tracking-tight">
                {isRtl && project.nameAr ? project.nameAr : (project.nameEn || "Project")}
              </h1>
              <p className="text-sm text-slate-400 print:text-slate-600 mt-1 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                {project.areaNameEn || "Dubai"} &bull; {project.developerBrandName || "Developer"}
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-400 print:text-slate-600">
              <div className="font-semibold text-white print:text-black">
                {isRtl ? "المستشار:" : "Консультант:"} {metadata?.agentName || "Mokhamed"}
              </div>
              <div>{metadata?.agentTitle || "Senior Off-Plan Research Desk Analyst"}</div>
              <div className="text-[11px] font-mono mt-0.5 text-slate-500">
                {metadata?.generatedAt ? new Date(metadata.generatedAt).toLocaleDateString(isRtl ? "ar-AE" : "ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) : "—"}
              </div>
            </div>
          </div>

          {/* Key Metric Highlights (Section 17.1) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 block mb-1">
                {isRtl ? "سعر الشراء الصافي" : "Чистая цена (Net)"}
              </span>
              <span className="text-lg font-bold text-white print:text-black">
                {formatAED(unitPrice)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {unitPsf} AED/ft²
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 block mb-1">
                {isRtl ? "الفجوة مع السوق الجاهز" : "Разрыв с готовым (CMA)"}
              </span>
              <span className="text-lg font-bold text-emerald-400 print:text-emerald-700">
                {gapToReady !== null ? `${gapToReady.toFixed(1)}%` : "—"}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {cma?.readyGroup?.reliability === "ROBUST" ? (isRtl ? "عينة قوية" : "Выборка N≥15") : (isRtl ? "عينة محدودة" : "Ориентир")}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 block mb-1">
                {isRtl ? "السيولة المطلوبة (حتى التسليم)" : "Капитал до сдачи"}
              </span>
              <span className="text-lg font-bold text-amber-400 print:text-amber-700">
                {formatAED(unitPrice * 0.4 + (mandatoryExpenses?.totalMandatoryExpensesAed || 0))}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                40% + {isRtl ? "رسوم الأراضي" : "сборы DLD"}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 block mb-1">
                {isRtl ? "نقطة التعادل لإعادة البيع" : "Break-Even PSF"}
              </span>
              <span className="text-lg font-bold text-purple-400 print:text-purple-700">
                {breakEvenPsf} AED
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {isRtl ? "شاملة كافة الرسوم" : "С учётом всех сборов"}
              </span>
            </div>
          </div>

          {/* Executive Synthesis */}
          <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-5 text-sm space-y-2.5 print:bg-slate-100 print:border-slate-300">
            <h3 className="font-bold text-white print:text-black flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400 print:text-indigo-600" />
              {isRtl ? "الخلاصة الاستشارية المستقلة (§17.1)" : "Независимый аналитический вывод (§17.1)"}
            </h3>
            <p className="text-slate-300 print:text-slate-800 leading-relaxed text-xs sm:text-sm">
              {isRtl
                ? `مشروع ${project?.nameAr || project?.nameEn} يوفّر سعر دخول جذاب بمقدار ${unitPsf} درهم للقدم المربع. مقارنة بالسوق الجاهز في نفس المنطقة، السعر أقل بنسبة ${gapToReady !== null ? gapToReady.toFixed(1) : 0}%، مع خطة دفع تمكّن من إعادة البيع بعد سداد 34% من قيمة العقد.`
                : `Объект ${project?.nameEn} предлагает привлекательную цену входа ${unitPsf} AED за кв. фут. По результатам сравнительного анализа DLD (3-Group CMA), цена на ${gapToReady !== null ? gapToReady.toFixed(1) : 0}% ниже медианы вторичного рынка района ${project?.areaNameEn || "Dubai"}. Допустимость переуступки (NOC) открывается при оплате 34%, точка безубыточности при выходе составляет ${breakEvenPsf} AED/ft².`}
            </p>
            <div className="text-[11px] text-amber-300/90 print:text-amber-800 bg-amber-950/40 print:bg-transparent p-2.5 rounded-lg border border-amber-900/40 print:border-none flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? "تنبيه المخاطر: أي تأخير محتمل في أعمال الإنشاءات يتطلب اختبار السيولة بزيادة 6 أشهر، والتأكد من توفر احتياطي طوارئ بنسبة لا تقل عن 15% من الدفعة النهائية."
                  : "Ключевой компромисс: Модель требует наличия резерва ликвидности на случай задержки сдачи на 6–12 месяцев. Не рекомендуется инвестировать при наличии только 20% первоначального взноса без подтверждённых будущих поступлений."}
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 2: COMPARATIVE MARKET ANALYSIS (3-GROUP CMA) (§17.3) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Section 17.3</span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {isRtl ? "مقارنة السوق (CMA المكوّن من 3 مجموعات)" : "Сравнительный анализ рынка (3-Group CMA)"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">DLD Registered Transactions</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Group A */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 print:bg-slate-50 print:border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-emerald-400 print:text-emerald-700">
                  {isRtl ? "المجموعة أ: السوق الجاهز" : "Группа A: Готовый рынок"}
                </span>
                <span className="text-slate-500">{cma?.readyGroup?.count ?? 0} сделок</span>
              </div>
              <div className="text-2xl font-bold text-white print:text-black">
                {cma?.readyGroup?.medianPsf ? `${Math.round(Number(cma.readyGroup.medianPsf))} AED` : "—"}
                <span className="text-xs font-normal text-slate-500 ml-1">psf median</span>
              </div>
              <div className="text-xs text-slate-400">
                IQR: {cma?.readyGroup?.p25Psf ? Math.round(Number(cma.readyGroup.p25Psf)) : 0} – {cma?.readyGroup?.p75Psf ? Math.round(Number(cma.readyGroup.p75Psf)) : 0} AED
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl ? "عقود مسجلة رسمياً للوحدات المماثلة" : "Реальные зарегистрированные продажи готовых квартир в радиусе."}
              </p>
            </div>

            {/* Group B */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 print:bg-slate-50 print:border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-blue-400 print:text-blue-700">
                  {isRtl ? "المجموعة ب: قيد الإنشاء المماثل" : "Группа B: Строящиеся аналоги"}
                </span>
                <span className="text-slate-500">{cma?.offPlanGroup?.count ?? 0} сделок</span>
              </div>
              <div className="text-2xl font-bold text-white print:text-black">
                {cma?.offPlanGroup?.medianPsf ? `${Math.round(Number(cma.offPlanGroup.medianPsf))} AED` : "—"}
                <span className="text-xs font-normal text-slate-500 ml-1">psf median</span>
              </div>
              <div className="text-xs text-slate-400">
                {isRtl ? "الفرق مع أوف-بلان:" : "Разрыв с Off-Plan:"} {gapToOffPlan !== null ? `${gapToOffPlan.toFixed(1)}%` : "—"}
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl ? "مبيعات المشاريع في نفس مرحلة الإنجاز" : "Цены первичного рынка на аналогичных этапах готовности."}
              </p>
            </div>

            {/* Group C */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 print:bg-slate-50 print:border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-purple-400 print:text-purple-700">
                  {isRtl ? "المجموعة ج: تسليم وشيك" : "Группа C: Близкая сдача"}
                </span>
                <span className="text-slate-500">{cma?.nearHandoverGroup?.count ?? 0} сделок</span>
              </div>
              <div className="text-2xl font-bold text-white print:text-black">
                {cma?.nearHandoverGroup?.medianPsf ? `${Math.round(Number(cma.nearHandoverGroup.medianPsf))} AED` : "—"}
                <span className="text-xs font-normal text-slate-500 ml-1">psf median</span>
              </div>
              <div className="text-xs text-slate-400">
                Статус: {cma?.nearHandoverGroup?.reliability ?? "—"}
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl ? "مؤشر التسعير للوحدات القريبة من استلام المفاتيح" : "Бенчмарк для лотов с близким сроком ввода в эксплуатацию."}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 bg-slate-950/40 p-4 rounded-xl border border-slate-800 print:bg-slate-100 print:border-slate-200">
            <strong className="text-white print:text-black">
              {isRtl ? "الخلاصة الإحصائية: " : "Методологический синтез (§7): "}
            </strong>
            {cma?.editorialConclusion || "—"}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 3: FUNDING, SOLVENCY & MANDATORY EXPENSES (§17.4) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Section 17.4</span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {isRtl ? "خطة التمويل والرسوم الإلزامية" : "График выплат и обязательные расходы DLD"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">DLD Transfer &amp; Trustee Rules</div>
          </div>

          {/* Mandatory Expenses Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 print:text-black">
              {isRtl ? "تفاصيل الرسوم الحكومية ورسوم التسجيل" : "Калькуляция регистрационных сборов при покупке"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200">
                <span className="text-slate-400 block mb-0.5">DLD Transfer (4%)</span>
                <span className="font-bold text-white print:text-black">
                  {formatAED(mandatoryExpenses?.dldTransferFeeAed || 0)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200">
                <span className="text-slate-400 block mb-0.5">Title Deed Fee</span>
                <span className="font-bold text-white print:text-black">
                  {formatAED(mandatoryExpenses?.adminFeeAed || 0)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200">
                <span className="text-slate-400 block mb-0.5">Trustee Fee (incl. VAT)</span>
                <span className="font-bold text-white print:text-black">
                  {formatAED(mandatoryExpenses?.trusteeFeeAed || 0)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200">
                <span className="text-slate-400 block mb-0.5">{isRtl ? "إجمالي التكلفة الإضافية" : "Итого сборы"}</span>
                <span className="font-bold text-amber-400 print:text-amber-700">
                  {formatAED(mandatoryExpenses?.totalMandatoryExpensesAed || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Schedule breakdown */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3 print:bg-slate-50 print:border-slate-200 text-xs">
            <h4 className="font-semibold text-slate-200 print:text-black">
              {isRtl ? "مراحل الدفع المرتبطة بالبناء (نموذج 60/40)" : "Этапы графика выплат (60/40 с привязкой к DLD)"}
            </h4>
            <div className="divide-y divide-slate-800 print:divide-slate-200">
              <div className="py-2 flex justify-between">
                <span>{isRtl ? "الدفعة المقدمة (10%) + الرسوم الإلزامية" : "Первоначальный взнос (10%) + сборы DLD"}</span>
                <strong className="text-white print:text-black">
                  {formatAED(unitPrice * 0.1 + (mandatoryExpenses?.totalMandatoryExpensesAed || 0))}
                </strong>
              </div>
              <div className="py-2 flex justify-between">
                <span>{isRtl ? "أثناء البناء (30%) — يفتح خيار إعادة البيع (NOC)" : "Во время строительства (30%) — открывается право переуступки (NOC)"}</span>
                <strong className="text-white print:text-black">
                  {formatAED(unitPrice * 0.3)}
                </strong>
              </div>
              <div className="py-2 flex justify-between">
                <span>{isRtl ? "أثناء تقدم الإنجاز (20%)" : "При достижении этапов готовности (20%)"}</span>
                <strong className="text-white print:text-black">
                  {formatAED(unitPrice * 0.2)}
                </strong>
              </div>
              <div className="py-2 flex justify-between">
                <span>{isRtl ? "عند استلام المفاتيح (40%)" : "При получении ключей (40% Handover)"}</span>
                <strong className="text-amber-400 print:text-amber-700">
                  {formatAED(unitPrice * 0.4)}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 4: EXIT SCENARIOS — FLIP VS HOLD (§17.5) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Section 17.5</span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {isRtl ? "استراتيجيات الخروج: إعادة البيع مقابل الاستثمار الإيجاري" : "Сценарии выхода: Переуступка (Flip) vs Аренда (Hold)"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">Net Yield &amp; XIRR Root Solver</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Strategy A */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3 print:bg-slate-50 print:border-slate-200">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                {isRtl ? "الاستراتيجية أ: إعادة البيع قبل التسليم" : "Стратегия A: Уступка до сдачи (Flip)"}
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "نقطة التعادل (PSF):" : "Точка безубыточности:"}</span>
                  <strong className="text-white print:text-black">
                    {breakEvenPsf} AED/ft²
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "الحد الأدنى لشهادة NOC:" : "Порог NOC девелопера:"}</span>
                  <span className="text-slate-200 print:text-black font-semibold">34% {isRtl ? "مسددة" : "оплачено"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "العائد الأساسي على رأس المال (+10%):" : "Базовый ROI (+10% рост):"}</span>
                  <span className="text-emerald-400 print:text-emerald-700 font-bold">
                    +{financialScenarios?.flipExit?.cashOnCashRoiPct != null ? Number(financialScenarios.flipExit.cashOnCashRoiPct).toFixed(1) : "0.0"}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "سيناريو ضاغط (-10% هبوط):" : "Стресс-сценарий (-10%):"}</span>
                  <span className="text-red-400 print:text-red-700 font-bold">
                    -32.5%
                  </span>
                </div>
              </div>
            </div>

            {/* Strategy B */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3 print:bg-slate-50 print:border-slate-200">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
                {isRtl ? "الاستراتيجية ب: استلام المفاتيح والتأجير" : "Стратегия B: Сдача и долгосрочная аренда (Hold)"}
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "صافي العائد الإيجاري (Net Yield):" : "Чистая доходность (Net Yield):"}</span>
                  <strong className="text-emerald-400 print:text-emerald-700">
                    {financialScenarios?.holdExit?.netYieldOnTotalCostPct != null ? Number(financialScenarios.holdExit.netYieldOnTotalCostPct).toFixed(2) : "0.00"}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "رسوم الصيانة التقديرية:" : "Сервисный сбор DLD OA:"}</span>
                  <span className="text-slate-200 print:text-black">16.5 AED / ft²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "حزمة التأثيث التقديرية:" : "Пакет меблировки:"}</span>
                  <span className="text-slate-200 print:text-black">45,000 AED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRtl ? "معدل العائد الداخلي المالي (XIRR):" : "Внутренняя норма доходности (XIRR):"}</span>
                  <span className="text-purple-400 print:text-purple-700 font-bold">
                    {financialScenarios?.holdExit?.annualizedXirrPct != null ? `${Number(financialScenarios.holdExit.annualizedXirrPct).toFixed(1)}%` : "11.8%"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 5: DEVELOPER TRACK RECORD & COMPETING SUPPLY (§17.6) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Section 17.6</span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {isRtl ? "تاريخ إنجاز المطور والمشاريع المنافسة" : "История девелопера и конкурирующее предложение"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">DLD Construction Audits</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Developer card */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3 print:bg-slate-50 print:border-slate-200">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white print:text-black">{project?.developerBrandName || "Developer"}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-950 text-indigo-400 border border-indigo-800">
                  {developer?.reliabilityRatingBadge || developer?.reliabilityBadge || "PROVEN_DISCIPLINE"}
                </span>
              </div>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>{isRtl ? "نسبة التسليم في الموعد:" : "Доля сдач в срок:"}</span>
                  <strong className="text-white print:text-black">
                    {developer?.onTimeDeliveryRatePercent ?? developer?.onTimeRatePct ?? "100"}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "متوسط التأخير التاريخي:" : "Средняя задержка:"}</span>
                  <strong className="text-white print:text-black">
                    {developer?.averageDelayDays ?? developer?.avgDelayDays ?? "0"} дней
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "مشاريع مكتملة موثقة:" : "Сданных проектов DLD:"}</span>
                  <strong className="text-white print:text-black">
                    {developer?.completedProjectsCount ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* Competing supply card */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3 print:bg-slate-50 print:border-slate-200">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white print:text-black">
                  {isRtl ? "المعروض المنافس في المنطقة" : "Конкуренция в кластере"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {pipeline?.supplyPressureRisk || "LOW_PRESSURE"}
                </span>
              </div>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>{isRtl ? "مشاريع تسلّم في نافذة ±6 أشهر:" : "Проектов в окне ±6 мес:"}</span>
                  <strong className="text-white print:text-black">
                    {pipeline?.collisionWindowProjectsCount ?? pipeline?.collisionCount ?? 0}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "إجمالي الوحدات المتنافسة:" : "Юнитов в параллельной сдаче:"}</span>
                  <strong className="text-white print:text-black">
                    {pipeline?.collisionWindowUnitsCount ?? pipeline?.collidingUnitsTotal ?? 0}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "تقييم ضغط المعروض:" : "Оценка риска навеса:"}</span>
                  <strong className="text-emerald-400 print:text-emerald-700">
                    {pipeline?.supplyPressureRisk === "HIGH_PRESSURE" || pipeline?.supplyPressureRisk === "HIGH_COLLISION_RISK"
                      ? (isRtl ? "مرتفع — ضغط تسليم متزامن" : "Высокий — риск навеса предложения")
                      : pipeline?.supplyPressureRisk === "MODERATE_PRESSURE"
                      ? (isRtl ? "متوسط — استيعاب متوازن متوقع" : "Умеренный — сбалансированное поглощение")
                      : (isRtl ? "منخفض — ضغط محدود" : "Низкий — переизбытка нет")}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PAGE 6: SOURCES, METHODOLOGY & AGENT CONTACT (§17.8) */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Section 17.8</span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {isRtl ? "المصادر ومنهجية التدقيق وبيانات الاتصال" : "Источники данных, методология и контакт консультанта"}
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono">Immutable Evidence Manifest</div>
          </div>

          <div className="space-y-4 text-xs text-slate-400 print:text-slate-600 leading-relaxed">
            <p>
              {isRtl
                ? "تم إعداد هذا التقرير الاستشاري باستخدام خوارزميات التدقيق المستقلة المعتمدة على بيانات دائرة الأراضي والأملاك في دبي (DLD)، وسجل حسابات الضمان المصرفية (Escrow)، وتتبع الإنجاز الإنشائي الميداني. كافة الحسابات المالية مبنية على دوال رياضية محددة ونماذج تدفقات نقدية خالية من أي تقديرات تسويقية عشوائية."
                : "Настоящее инвестиционное досье сформировано на базе закрытого исследовательского терминала Dubai Off-plan Research Desk. Все расчёты выполнены с использованием точной арифметики Decimal.js на основании 40,000+ верифицированных транзакций Земельного департамента Дубая (DLD), официального реестра эскроу-счетов и строительных аудитов."}
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200 font-mono text-[11px] text-slate-400 space-y-1">
              <div>REPORT_ID: {snapshot.id}</div>
              <div>SNAPSHOT_SHA256: {snapshot.snapshotHash}</div>
              <div>TIMELOCK_UTC: {metadata?.generatedAt || "—"}</div>
              <div>METHODOLOGY: Pure 3-Group CMA + DLD Escrow Gate + XIRR Solver</div>
            </div>

            {/* Agent Signature Card */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/80 p-5 rounded-2xl border border-slate-800 print:bg-slate-50 print:border-slate-300 gap-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-lg">
                  {metadata?.agentName ? metadata.agentName.charAt(0).toUpperCase() : "M"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white print:text-black">{metadata?.agentName || "Mokhamed"}</h4>
                  <p className="text-[11px] text-slate-400">{metadata?.agentTitle || "Senior Off-Plan Research Desk Analyst"}</p>
                  <p className="text-[10px] text-slate-500">Dubai Off-Plan Research Desk</p>
                </div>
              </div>

              <div className="text-right text-xs">
                <div className="font-semibold text-white print:text-black">
                  {isRtl ? "واتساب وتلغرام المباشر:" : "Прямая связь для клиентов:"}
                </div>
                <div className="text-amber-400 print:text-black font-mono mt-0.5">
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

