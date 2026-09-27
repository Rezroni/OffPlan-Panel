/**
 * Domain Module: RU/AR Content Studio & Reels Generator (§16, §18)
 * Pure TypeScript functions with zero UI or external side-effects.
 */

import crypto from "crypto";

export type SupportedLocale = "ru" | "ar" | "en";

export interface StudioMetricBinding {
  metricId: string;
  labelEn: string;
  labelRu: string;
  labelAr: string;
  value: number | string | null;
  unit: "AED" | "AED_PSF" | "PERCENT" | "DAYS" | "UNITS" | "BADGE" | "TEXT";
  formattedRu: string;
  formattedAr: string;
}

export interface StudioProjectFacts {
  projectId: string;
  dldProjectId?: string | null;
  projectNameEn: string;
  projectNameAr?: string | null;
  developerBrand: string;
  developerBrandAr?: string | null;
  areaNameEn: string;
  areaNameAr?: string | null;
  bedrooms: number;
  areaSqft: number;
  priceAed: number;
  pricePsfAed: number;
  handoverDate: string; // "2028-12-01"
  cmaReadyMedianPsf: number | null;
  cmaGapReadyPct: number | null; // e.g. 14.5 (%)
  cmaSampleStatus: "ROBUST" | "WEAK_SAMPLE" | "INSUFFICIENT";
  developerOnTimePct: number | null;
  developerAvgDelayDays: number | null;
  developerReliabilityBadge: string;
  flipBreakEvenPsf: number;
  flipBaselineRoiPct: number;
  holdNetYieldPct: number;
  competingCollisionCount: number;
  competingSupplyRisk: "LOW_PRESSURE" | "MODERATE_PRESSURE" | "HIGH_COLLISION_RISK";
  agentName: string; // e.g. "Mokhamed"
}

export interface ScriptBlock {
  stage: number;
  timingSeconds: string;
  titleRu: string;
  titleAr: string;
  textRu: string;
  textAr: string;
  referencedMetricIds: string[];
}

export interface DualReelsScript {
  totalDurationSeconds: number; // e.g. 60
  blocks: ScriptBlock[];
  projectCode: string; // e.g. "DLD-529"
  metricsManifest: Record<string, StudioMetricBinding>;
}

export interface SocialCardSpec {
  format: "REELS_9_16" | "CAROUSEL_4_5" | "OVERLAY";
  width: number;
  height: number;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const SOCIAL_CARD_SPECS: Record<SocialCardSpec["format"], SocialCardSpec> = {
  REELS_9_16: {
    format: "REELS_9_16",
    width: 1080,
    height: 1920,
    safeArea: { top: 220, bottom: 280, left: 60, right: 60 },
  },
  CAROUSEL_4_5: {
    format: "CAROUSEL_4_5",
    width: 1080,
    height: 1350,
    safeArea: { top: 80, bottom: 80, left: 60, right: 60 },
  },
  OVERLAY: {
    format: "OVERLAY",
    width: 800,
    height: 450,
    safeArea: { top: 24, bottom: 24, left: 24, right: 24 },
  },
};

/**
 * Format AED amounts cleanly across locales
 */
export function formatAedLocale(val: number | null, locale: SupportedLocale): string {
  if (val === null || val === undefined) return "—";
  const numStr = Math.round(val).toLocaleString(locale === "ar" ? "ar-AE" : "ru-RU").replace(/\s/g, " ");
  if (locale === "ar") return `${numStr} د.إ`;
  return `${numStr} AED`;
}

/**
 * Format Percentages cleanly across locales
 */
export function formatPercentLocale(val: number | null, locale: SupportedLocale, decimals = 1): string {
  if (val === null || val === undefined) return "—";
  const formatted = val.toFixed(decimals);
  if (locale === "ar") return `%${formatted}`;
  return `${formatted}%`;
}

/**
 * Build whitelist of metric bindings from raw project facts
 */
export function buildStudioMetricsManifest(facts: StudioProjectFacts): Record<string, StudioMetricBinding> {
  const manifest: Record<string, StudioMetricBinding> = {
    METRIC_TARGET_PRICE_AED: {
      metricId: "METRIC_TARGET_PRICE_AED",
      labelEn: "Purchase Price",
      labelRu: "Цена приобретения",
      labelAr: "سعر الشراء",
      value: facts.priceAed,
      unit: "AED",
      formattedRu: formatAedLocale(facts.priceAed, "ru"),
      formattedAr: formatAedLocale(facts.priceAed, "ar"),
    },
    METRIC_TARGET_PSF_AED: {
      metricId: "METRIC_TARGET_PSF_AED",
      labelEn: "Price per Sq.Ft.",
      labelRu: "Цена за кв. фут",
      labelAr: "سعر القدم المربع",
      value: facts.pricePsfAed,
      unit: "AED_PSF",
      formattedRu: `${Math.round(facts.pricePsfAed)} AED/ft²`,
      formattedAr: `${Math.round(facts.pricePsfAed)} د.إ/قدم²`,
    },
    METRIC_READY_MEDIAN_PSF: {
      metricId: "METRIC_READY_MEDIAN_PSF",
      labelEn: "Ready Market Median PSF",
      labelRu: "Медиана готового рынка (CMA)",
      labelAr: "متوسط السوق الجاهز",
      value: facts.cmaReadyMedianPsf,
      unit: "AED_PSF",
      formattedRu: facts.cmaReadyMedianPsf ? `${Math.round(facts.cmaReadyMedianPsf)} AED/ft²` : "Недостаточно данных",
      formattedAr: facts.cmaReadyMedianPsf ? `${Math.round(facts.cmaReadyMedianPsf)} د.إ/قدم²` : "بيانات غير كافية",
    },
    METRIC_CMA_GAP_READY_PCT: {
      metricId: "METRIC_CMA_GAP_READY_PCT",
      labelEn: "Discount/Premium vs Ready Market",
      labelRu: "Разрыв с готовым рынком",
      labelAr: "الفجوة السعرية مقارنة بالجاهز",
      value: facts.cmaGapReadyPct,
      unit: "PERCENT",
      formattedRu: formatPercentLocale(facts.cmaGapReadyPct, "ru"),
      formattedAr: formatPercentLocale(facts.cmaGapReadyPct, "ar"),
    },
    METRIC_DEVELOPER_ON_TIME_PCT: {
      metricId: "METRIC_DEVELOPER_ON_TIME_PCT",
      labelEn: "Developer On-Time Completion Rate",
      labelRu: "Доля сдач в срок застройщика",
      labelAr: "نسبة التسليم في الموعد للمطور",
      value: facts.developerOnTimePct,
      unit: "PERCENT",
      formattedRu: formatPercentLocale(facts.developerOnTimePct, "ru", 0),
      formattedAr: formatPercentLocale(facts.developerOnTimePct, "ar", 0),
    },
    METRIC_BREAK_EVEN_RESALE_PSF: {
      metricId: "METRIC_BREAK_EVEN_RESALE_PSF",
      labelEn: "Break-Even Resale PSF",
      labelRu: "Безубыточный выход (PSF)",
      labelAr: "سعر نقطة التعادل للقدم",
      value: facts.flipBreakEvenPsf,
      unit: "AED_PSF",
      formattedRu: `${Math.round(facts.flipBreakEvenPsf)} AED/ft²`,
      formattedAr: `${Math.round(facts.flipBreakEvenPsf)} د.إ/قدم²`,
    },
    METRIC_FLIP_BASELINE_ROI_PCT: {
      metricId: "METRIC_FLIP_BASELINE_ROI_PCT",
      labelEn: "Flip Baseline Cash-on-Cash ROI",
      labelRu: "Базовый ROI уступки",
      labelAr: "العائد على رأس المال لإعادة البيع",
      value: facts.flipBaselineRoiPct,
      unit: "PERCENT",
      formattedRu: formatPercentLocale(facts.flipBaselineRoiPct, "ru"),
      formattedAr: formatPercentLocale(facts.flipBaselineRoiPct, "ar"),
    },
    METRIC_HOLD_NET_YIELD_PCT: {
      metricId: "METRIC_HOLD_NET_YIELD_PCT",
      labelEn: "Net Rental Yield on Total Cost",
      labelRu: "Чистая доходность аренды (Net Yield)",
      labelAr: "صافي العائد الإيجاري من التكلفة الإجمالية",
      value: facts.holdNetYieldPct,
      unit: "PERCENT",
      formattedRu: formatPercentLocale(facts.holdNetYieldPct, "ru"),
      formattedAr: formatPercentLocale(facts.holdNetYieldPct, "ar"),
    },
    METRIC_COMPETING_COLLISION_COUNT: {
      metricId: "METRIC_COMPETING_COLLISION_COUNT",
      labelEn: "Competing Developments in Window",
      labelRu: "Конкурирующих сданных объектов (±6 мес)",
      labelAr: "مشاريع منافسة تسلّم في نفس الفترة",
      value: facts.competingCollisionCount,
      unit: "UNITS",
      formattedRu: `${facts.competingCollisionCount} проектов`,
      formattedAr: `${facts.competingCollisionCount} مشاريع`,
    },
  };

  return manifest;
}

/**
 * Generate 5-stage Reels script strictly enforcing Section 16 structure
 */
export function generateReelsScript(facts: StudioProjectFacts): DualReelsScript {
  const metrics = buildStudioMetricsManifest(facts);
  const projectCode = facts.dldProjectId ? `DLD-${facts.dldProjectId}` : facts.projectId.replace("proj_", "").slice(0, 8);
  const brLabelRu = facts.bedrooms === 0 ? "Студия" : `${facts.bedrooms}-спальная квартира`;
  const brLabelAr = facts.bedrooms === 0 ? "استوديو" : `شقة ${facts.bedrooms} غرف نوم`;

  // Gap description
  const gapTextRu =
    facts.cmaGapReadyPct !== null && facts.cmaGapReadyPct > 0
      ? `на ${facts.cmaGapReadyPct.toFixed(1)}% ниже медианы уже сданных домов в ${facts.areaNameEn}`
      : facts.cmaGapReadyPct !== null && facts.cmaGapReadyPct < 0
      ? `с премией +${Math.abs(facts.cmaGapReadyPct).toFixed(1)}% за современный фонд к готовым домам 15-летней давности в ${facts.areaNameEn}`
      : `на уровне текущего вторичного рынка`;

  const gapTextAr =
    facts.cmaGapReadyPct !== null && facts.cmaGapReadyPct > 0
      ? `أقل بنسبة ${facts.cmaGapReadyPct.toFixed(1)}% من متوسط أسعار العقارات الجاهزة في ${facts.areaNameAr || facts.areaNameEn}`
      : facts.cmaGapReadyPct !== null && facts.cmaGapReadyPct < 0
      ? `بعلاوة +${Math.abs(facts.cmaGapReadyPct).toFixed(1)}% للبناء الحديث مقارنة بالعقارات الجاهزة في ${facts.areaNameAr || facts.areaNameEn}`
      : `متوافق مع متوسط الأسعار الحالية في السوق`;

  // Trade-off description
  const tradeOffRu =
    facts.competingCollisionCount >= 3
      ? `В окне сдачи проекта в этом же кластере одновременно выходят ключи ещё в ${facts.competingCollisionCount} проектах. Это создаст краткосрочную конкуренцию на аренду.`
      : facts.developerOnTimePct !== null && facts.developerOnTimePct < 70
      ? `Историческая статистика застройщика по DLD показывает задержки в ${Math.round(facts.developerAvgDelayDays || 120)} дней. Финансовую модель нужно стресс-тестировать минимум на +6 месяцев.`
      : `Пул предложений требует обязательного запаса ликвидности по 40% взносу при передаче ключей, даже если заявлен флип.`;

  const tradeOffAr =
    facts.competingCollisionCount >= 3
      ? `خلال نافذة التسليم، يوجد ${facts.competingCollisionCount} مشاريع منافسة في نفس المنطقة، مما قد يشكل ضغطاً مؤقتاً على المعروض الإيجاري.`
      : facts.developerOnTimePct !== null && facts.developerOnTimePct < 70
      ? `سجل المطور في دائرة الأراضي يظهر متوسط تأخير ${Math.round(facts.developerAvgDelayDays || 120)} يوم، لذا يجب اختبار السيولة مع سيناريو تأخير 6 أشهر.`
      : `يتطلب الاستثمار تأكيد خطة سيولة كاملة قبل موعد التسليم لتجنب أي تعثر في حال تغيرت شروط إعادة البيع.`;

  const blocks: ScriptBlock[] = [
    {
      stage: 1,
      timingSeconds: "0–5s",
      titleRu: "Хук (Наблюдение без ложного хайпа)",
      titleAr: "المقدمة (سؤال مباشر وملاحظة واقعية)",
      textRu: `Сколько на самом деле стоит квадратный фут в ${facts.projectNameEn}, и оправданы ли обещания брокеров? Давайте посмотрим в реестр сделок DLD.`,
      textAr: `ما هو السعر الحقيقي للقدم في مشروع ${facts.projectNameAr || facts.projectNameEn} بعيداً عن إعلانات التسويق؟ إليكم الأرقام الموثقة من دائرة الأراضي والأملاك.`,
      referencedMetricIds: ["METRIC_TARGET_PSF_AED"],
    },
    {
      stage: 2,
      timingSeconds: "5–20s",
      titleRu: "Цена лота и рыночный контекст (CMA)",
      titleAr: "السعر ومقارنة السوق الجاهز (CMA)",
      textRu: `${brLabelRu} площадью ${facts.areaSqft} кв. футов стоит ${metrics.METRIC_TARGET_PRICE_AED.formattedRu} — это ${metrics.METRIC_TARGET_PSF_AED.formattedRu}. По нашей независимой оценке готового рынка, цена ${gapTextRu}.`,
      textAr: `${brLabelAr} بمساحة ${facts.areaSqft} قدم² بسعر ${metrics.METRIC_TARGET_PRICE_AED.formattedAr}، أي ${metrics.METRIC_TARGET_PSF_AED.formattedAr}. السعر ${gapTextAr}.`,
      referencedMetricIds: [
        "METRIC_TARGET_PRICE_AED",
        "METRIC_TARGET_PSF_AED",
        "METRIC_READY_MEDIAN_PSF",
        "METRIC_CMA_GAP_READY_PCT",
      ],
    },
    {
      stage: 3,
      timingSeconds: "20–40s",
      titleRu: "График платежей и условия выхода",
      titleAr: "خطة الدفع واستراتيجية الخروج",
      textRu: `Для безопасной уступки до сдачи точка безубыточности составляет ${metrics.METRIC_BREAK_EVEN_RESALE_PSF.formattedRu} с учётом обязательных 4% DLD и комиссии. При консервативном росте расчетный ROI на вложенный капитал — ${metrics.METRIC_FLIP_BASELINE_ROI_PCT.formattedRu}. А чистая аренда при сдаче дает ${metrics.METRIC_HOLD_NET_YIELD_PCT.formattedRu}.`,
      textAr: `لإعادة البيع بأمان، نقطة التعادل بعد رسوم دائرة الأراضي 4% ورسوم المطور هي ${metrics.METRIC_BREAK_EVEN_RESALE_PSF.formattedAr}. العائد المتوقع على رأس المال هو ${metrics.METRIC_FLIP_BASELINE_ROI_PCT.formattedAr}، وصافي العائد الإيجاري ${metrics.METRIC_HOLD_NET_YIELD_PCT.formattedAr}.`,
      referencedMetricIds: [
        "METRIC_BREAK_EVEN_RESALE_PSF",
        "METRIC_FLIP_BASELINE_ROI_PCT",
        "METRIC_HOLD_NET_YIELD_PCT",
      ],
    },
    {
      stage: 4,
      timingSeconds: "40–55s",
      titleRu: "Существенный компромисс и риск",
      titleAr: "المخاطر والتحدي الرئيسي للمشروع",
      textRu: tradeOffRu,
      textAr: tradeOffAr,
      referencedMetricIds: [
        "METRIC_COMPETING_COLLISION_COUNT",
        "METRIC_DEVELOPER_ON_TIME_PCT",
      ],
    },
    {
      stage: 5,
      timingSeconds: "55–75s",
      titleRu: "Завершение и призыв к действию",
      titleAr: "الخاتمة والدعوة لاتخاذ قرار",
      textRu: `Напишите код ${projectCode} мне в личные сообщения — пришлю полный 6-страничный аудит с графиком выплат и двумя альтернативами под ваш бюджет.`,
      textAr: `أرسل الرمز ${projectCode} في رسالة خاصة، وسأرسل لك التقرير المالي الشامل المكوّن من 6 صفحات مع بديلين مدروسين لميزانيتك.`,
      referencedMetricIds: [],
    },
  ];

  return {
    totalDurationSeconds: 65,
    blocks,
    projectCode,
    metricsManifest: metrics,
  };
}

/**
 * Generate immutable SHA-256 hash for report snapshots (§17)
 */
export function generateReportSnapshotHash(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(serialized).digest("hex");
}
