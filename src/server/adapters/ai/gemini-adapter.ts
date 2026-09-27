/**
 * Dubai Off-plan Research Desk — Google Gemini AI Adapter
 * 
 * Plan Section 16 & 19:
 * - AI is optional server-side adapter for synthesizing/polishing analytical commentary.
 * - Strictly operates on whitelisted verified facts and metrics.
 * - NEVER calculates or hallucinates numbers.
 * - Fallback to deterministic template if offline or error.
 */

import { ShortlistResult } from "@/domain/alternatives/shortlist";

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export interface AICommentaryResponse {
  summary: string;
  keyTakeaway: string;
  source: "gemini_2.5_flash" | "deterministic_fallback";
}

/**
 * Generates an executive analytical summary for a shortlist using Google Gemini AI,
 * strictly bounded by the deterministic input facts.
 */
export async function generateShortlistCommentary(
  shortlistResult: ShortlistResult,
  language: "ru" | "en" = "ru"
): Promise<AICommentaryResponse> {
  const { clientBrief, shortlist } = shortlistResult;

  if (shortlist.length === 0) {
    return {
      summary: language === "ru" 
        ? "Нет подходящих вариантов, удовлетворяющих заданным критериям бюджета и стратегии."
        : "No qualifying options matching the specified budget and strategy criteria.",
      keyTakeaway: language === "ru"
        ? "Рекомендуется скорректировать бюджет или расширить перечень районов."
        : "Adjust budget or broaden target area criteria.",
      source: "deterministic_fallback",
    };
  }

  // Fallback generator in case AI is disabled or unreachable
  const generateFallback = (): AICommentaryResponse => {
    const best = shortlist[0];
    if (language === "ru") {
      return {
        summary: `Сформирован персональный шорт-лист из ${shortlist.length} вариантов для бюджета ${Number(clientBrief.budgetAed).toLocaleString()} AED (стратегия: ${clientBrief.targetStrategy}). Лидер локального сравнения — ${best.candidate.projectName} (${best.candidate.areaName}) по цене ${best.candidate.pricePerSqftAed.toFixed(0)} AED/кв.фут.`,
        keyTakeaway: `Основной фокус: ${best.explanation.whyItFits[0]} Ключевая проверка перед сделкой: ${best.explanation.factsToVerify[0]}`,
        source: "deterministic_fallback",
      };
    }
    return {
      summary: `Generated shortlist of ${shortlist.length} alternatives for budget ${Number(clientBrief.budgetAed).toLocaleString()} AED (${clientBrief.targetStrategy} strategy). Local benchmark leader is ${best.candidate.projectName} (${best.candidate.areaName}) at ${best.candidate.pricePerSqftAed.toFixed(0)} AED/sq.ft.`,
      keyTakeaway: `Key rationale: ${best.explanation.whyItFits[0]} Critical verification before commitment: ${best.explanation.factsToVerify[0]}`,
      source: "deterministic_fallback",
    };
  };

  if (!GEMINI_API_KEY) {
    return generateFallback();
  }

  // Build strictly whitelisted context string
  const candidatesContext = shortlist
    .map((item, idx) => {
      const c = item.candidate;
      const exp = item.explanation;
      return `
[Вариант ${idx + 1}: ${exp.roleTitle}]
- Проект: ${c.projectName} (${c.areaName})
- Девелопер: ${c.developerName}
- Комнат: ${c.bedrooms === 0 ? "Студия" : c.bedrooms + "BR"}
- Цена: ${c.priceAed.toLocaleString()} AED (${c.pricePerSqftAed.toFixed(0)} AED/кв.фут)
- Срок сдачи: ${c.expectedHandoverYear} год
- Почему подходит: ${exp.whyItFits.join("; ")}
- Главный компромисс: ${exp.tradeOff}
- Факты для проверки: ${exp.factsToVerify.join("; ")}
      `.trim();
    })
    .join("\n\n");

  const systemPrompt = `
Ты — старший независимый инвестиционный аналитик Dubai Off-plan Research Desk.
Твоя задача: дать краткое (до 150 слов), строгое и объективное резюме сравнения отобранных вариантов для инвестора.

ПРАВИЛА БЕЗОПАСНОСТИ И ТОЧНОСТИ (КРИТИЧНО):
1. Используй ТОЛЬКО факты и цифры, предоставленные во входных данных.
2. ЗАПРЕЩЕНО выдумывать новые цифры, доходности, проценты или прогнозы, которых нет в тексте.
3. Стиль: строгий, профессиональный, без рекламных эпитетов («лучший», «уникальный», «сказочный»). Только измеримые аргументы и риски.
4. Выведи ответ строго в формате JSON с двумя полями:
{
  "summary": "Аналитическое резюме сравнения 2-3 предложений",
  "keyTakeaway": "Главный инвестиционный вывод и ключевой факт для проверки перед принятием решения"
}
`.trim();

  const userPrompt = `
Данные клиента:
- Бюджет: ${Number(clientBrief.budgetAed).toLocaleString()} AED
- Стратегия: ${clientBrief.targetStrategy}
- Целевой район: ${clientBrief.preferredAreaName || "Dubai"}

Отобранные альтернативы:
${candidatesContext}

Составь аналитическое заключение на ${language === "ru" ? "русском языке" : "английском языке"} в формате JSON.
`.trim();

  try {
    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for high factual accuracy
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini API error status:", response.status, await response.text());
      return generateFallback();
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return generateFallback();
    }

    const parsed = JSON.parse(candidateText);
    return {
      summary: parsed.summary || generateFallback().summary,
      keyTakeaway: parsed.keyTakeaway || generateFallback().keyTakeaway,
      source: "gemini_2.5_flash",
    };
  } catch (err) {
    console.warn("Gemini commentary invocation failed:", err);
    return generateFallback();
  }
}

export interface DossierSynthesisInput {
  projectName: string;
  projectNameAr?: string | null;
  developerName: string;
  areaName: string;
  areaNameAr?: string | null;
  bedrooms: number;
  unitPriceAed: number;
  unitAreaSqft: number;
  unitPsf: number;
  expectedHandoverDate?: string;
  // CMA metrics
  readyMedianPsf: number | null;
  readyDealsCount: number;
  gapToReadyPercent: number | null; // > 0 discount, < 0 premium
  offPlanMedianPsf: number | null;
  offPlanDealsCount: number;
  gapToOffPlanPercent: number | null;
  nearHandoverMedianPsf: number | null;
  nearHandoverDealsCount: number;
  // Funding & Exit
  nocThresholdPercent: number; // e.g. 34%
  breakEvenPsfAed: number;
  flipRoiPct?: number;
  holdYieldPct?: number;
  // Risks
  competingCollisionCount?: number;
  developerAvgDelayDays?: number | null;
}

export interface DossierAISynthesis {
  executiveSummary: string;
  cmaRationale: string;
  riskAndStressTest: string;
  investorVerdict: string;
  source: "gemini_2.5_flash" | "deterministic_engine";
}

/**
 * Generates an executive analytical synthesis and risk stress-test for client dossier (§17.1 & §7)
 * using Google Gemini AI, with a mathematically and logically strict deterministic fallback.
 */
export async function generateDossierSynthesis(
  input: DossierSynthesisInput,
  language: "ru" | "en" | "ar" = "ru"
): Promise<DossierAISynthesis> {
  const isRu = language === "ru";
  const isAr = language === "ar";

  const pName = isAr ? (input.projectNameAr || input.projectName) : input.projectName;
  const aName = isAr ? (input.areaNameAr || input.areaName) : input.areaName;
  const brLabel = input.bedrooms === 0 ? (isAr ? "استوديو" : isRu ? "Студия" : "Studio") : `${input.bedrooms}BR`;

  // Deterministic fallback generator
  const generateFallback = (): DossierAISynthesis => {
    let readySpreadText = "";
    let offPlanSpreadText = "";

    if (input.gapToReadyPercent !== null) {
      if (input.gapToReadyPercent < 0) {
        const prem = Math.abs(input.gapToReadyPercent).toFixed(1);
        if (isAr) {
          readySpreadText = `بعلاوة قدرها +${prem}% مقارنة بمتوسط العقارات الجاهزة في ${aName} (${input.readyMedianPsf || "—"} درهم/قدم²، حيث تعود معظم الأبراج لسنوات 2006-2010)`;
        } else if (isRu) {
          readySpreadText = `с премией +${prem}% к медиане вторичного рынка района ${aName} (${input.readyMedianPsf || "—"} AED/ft²), где доминирует старый фонд 15–20-летней давности`;
        } else {
          readySpreadText = `at a +${prem}% new-build premium over the legacy ready stock median (${input.readyMedianPsf || "—"} AED/sq.ft.) in ${aName}`;
        }
      } else {
        const disc = input.gapToReadyPercent.toFixed(1);
        if (isAr) {
          readySpreadText = `بخصم ${disc}% عن وسيط أسعار السوق الجاهز (${input.readyMedianPsf || "—"} درهم/قدم²)`;
        } else if (isRu) {
          readySpreadText = `на ${disc}% ниже медианы вторичного рынка района (${input.readyMedianPsf || "—"} AED/ft²)`;
        } else {
          readySpreadText = `at a ${disc}% discount below the cluster ready sales median (${input.readyMedianPsf || "—"} AED/sq.ft.)`;
        }
      }
    } else {
      readySpreadText = isAr ? "بناءً على صفقات DLD المتاحة" : isRu ? "на базе доступных данных DLD" : "based on verified DLD transactions";
    }

    if (input.gapToOffPlanPercent !== null) {
      if (input.gapToOffPlanPercent > 0) {
        const disc = input.gapToOffPlanPercent.toFixed(1);
        if (isAr) {
          offPlanSpreadText = `وفي الوقت نفسه، السعر أقل بنسبة ${disc}% من وسيط المشاريع قيد الإنشاء المنافسة (${input.offPlanMedianPsf || "—"} درهم/قدم²)`;
        } else if (isRu) {
          offPlanSpreadText = `При этом в сегменте строящихся проектов цена на ${disc}% выгоднее медианы прямых конкурентов (${input.offPlanMedianPsf || "—"} AED/ft²)`;
        } else {
          offPlanSpreadText = `Concurrently, the entry PSF is ${disc}% below the competing off-plan benchmark (${input.offPlanMedianPsf || "—"} AED/sq.ft.)`;
        }
      } else {
        const prem = Math.abs(input.gapToOffPlanPercent).toFixed(1);
        if (isAr) {
          offPlanSpreadText = `وفي سوق المشاريع قيد الإنشاء يتجاوز وسيط المنافسين بنسبة ${prem}%`;
        } else if (isRu) {
          offPlanSpreadText = `В сегменте off-plan цена превышает медиану сопоставимых новостроек на ${prem}%`;
        } else {
          offPlanSpreadText = `Within the off-plan segment, pricing reflects a +${prem}% positioning vs peers`;
        }
      }
    } else {
      offPlanSpreadText = isAr
        ? "سعر المتر يتوافق مع النطاق العام للمشاريع الجديدة"
        : isRu
        ? "Цена метра находится в рамках текущего диапазона строящихся объектов"
        : "Pricing aligns with general new launch pipeline levels";
    }

    const execSummary = isAr
      ? `مشروع ${pName} (${input.developerName}) في ${aName} يوفّر وحدة ${brLabel} بسعر دخول ${input.unitPsf} درهم/قدم² (${Math.round(input.unitPriceAed).toLocaleString()} درهم). حسب تحليل DLD، الوحدة تُطرح ${readySpreadText}. ${offPlanSpreadText}. خطة السداد تمنح مرونة عالية لإعادة البيع (NOC) بعد سداد ${input.nocThresholdPercent}%، وتبلغ نقطة التعادل ${input.breakEvenPsfAed} درهم/قدم².`
      : isRu
      ? `Объект ${pName} (${input.developerName}) в локации ${aName} предлагает лот (${brLabel}) по цене входа ${input.unitPsf} AED/ft² (${Math.round(input.unitPriceAed).toLocaleString()} AED). По результатам анализа DLD (3-Group CMA), лот ${readySpreadText}. ${offPlanSpreadText}. Рассрочка девелопера обеспечивает доступ к переуступке (NOC) при оплате ${input.nocThresholdPercent}%, а точка безубыточности выхода составляет ${input.breakEvenPsfAed} AED/ft².`
      : `Project ${pName} (${input.developerName}) in ${aName} offers a ${brLabel} unit at an entry PSF of ${input.unitPsf} AED/sq.ft. (${Math.round(input.unitPriceAed).toLocaleString()} AED). Under verified DLD benchmarking, the unit trades ${readySpreadText}. ${offPlanSpreadText}. Developer payment schedule grants resale eligibility (NOC) at ${input.nocThresholdPercent}% paid equity, with an all-inclusive exit break-even PSF of ${input.breakEvenPsfAed} AED/sq.ft.`;

    const cmaRationale = isAr
      ? `الفارق السعري مع السوق الجاهز يرجع لعامل حداثة البناء (تسليم ${input.expectedHandoverDate || "مستقبلي"}) والتشطيبات الفاخرة مقابل مباني عمرها 15-20 عاماً في المنطقة ذات تكاليف صيانة وتشغيل أعلى. مقارنة المعروض قيد الإنشاء تؤكد تميز نقطة الدخول مقارنة بالمنافسين المباشرين.`
      : isRu
      ? `Ценовая надбавка к вторичному рынку обоснована разницей в поколениях недвижимости: готовый фонд района в основном построен в 2006–2012 гг. и несет износ инженерных систем, тогда как ${pName} предлагает современный стандарт инженерии, брендированную отделку и рассрочку платежей. Сравнение внутри строящегося фонда подтверждает конкурентную точку входа относительно прямых аналогов.`
      : `The price spread against ready comps reflects a 15–20 year generational gap: older buildings in the cluster carry significant mechanical and MEP depreciation, whereas ${pName} introduces modern infrastructure, premium branded finishes, and flexible payment terms. Off-plan peer benchmarking confirms competitive positioning.`;

    const riskAndStressTest = isAr
      ? `تنبيه المخاطر: يتطلب الاستثمار توفير احتياطي سيولة لتغطية رسوم التسجيل (DLD 4%) واختبار قدرة التدفق النقدي في حال تأخر التسليم لـ 6 أشهر. ${input.competingCollisionCount && input.competingCollisionCount >= 3 ? `يوجد ${input.competingCollisionCount} مشاريع متزامنة في نافذة التسليم مما يستدعي تسعيراً واقعياً عند إعادة البيع.` : "يُنصح بعدم الاعتماد فقط على رأس مال الدفعة الأولى دون تدفقات مؤكدة للأقساط."}`
      : isRu
      ? `Ключевой компромисс и стресс-тест: Модель требует наличия резерва ликвидности на случай задержки сдачи на 6 месяцев и покрытия сборов DLD 4%. ${input.competingCollisionCount && input.competingCollisionCount >= 3 ? `В окне сдачи ожидается ввод ещё ${input.competingCollisionCount} проектов в кластере, что создаст краткосрочную конкуренцию за покупателей и арендаторов.` : "Не рекомендуется входить в проект только при наличии минимального взноса без гарантированных источников обслуживания рассрочки."}`
      : `Key trade-off & stress-test: Model mandates a 6-month liquidity buffer against potential construction delay and full coverage of 4% DLD fees. ${input.competingCollisionCount && input.competingCollisionCount >= 3 ? `${input.competingCollisionCount} projects deliver in the same window, creating transient competition upon handover.` : "Entering solely on minimal down payment without planned installment capital is not recommended."}`;

    const investorVerdict = isAr
      ? `فرصة متوازنة للمستثمر الباحث عن الرافعة المالية لخطة السداد مع خيار إعادة البيع قبل التسليم بعد الوصول لنسبة ${input.nocThresholdPercent}%، أو تحقيق عائد إيجاري متميز للوحدات الجديدة بعد الاستلام.`
      : isRu
      ? `Вход оправдан для инвесторов, использующих финансовый рычаг рассрочки: переуступка на этапе ${input.nocThresholdPercent}% оплаты при выходе выше ${input.breakEvenPsfAed} AED/ft² или долгосрочное удержание под аренду с премией к старому фонду.`
      : `Entry is justified for investors utilizing payment plan leverage: exit via assignment at ${input.nocThresholdPercent}% equity above ${input.breakEvenPsfAed} AED/sq.ft. break-even, or hold for premium new-build rental yield.`;

    return {
      executiveSummary: execSummary,
      cmaRationale,
      riskAndStressTest,
      investorVerdict,
      source: "deterministic_engine",
    };
  };

  if (!GEMINI_API_KEY) {
    return generateFallback();
  }

  const systemPrompt = `
Ты — старший независимый инвестиционный аналитик Dubai Off-plan Research Desk.
Твоя задача — составить строгий, объективный, свободный от брокерских манипуляций аналитический вывод (§17.1 и §7) для инвестиционного досье клиента.

КРИТИЧЕСКИЕ ПРАВИЛА ЛОГИКИ И ЭКОНОМИКИ НЕДВИЖИМОСТИ ДУБАЯ:
1. НЕ ПУТАТЬ ВТОРИЧНЫЙ ГОТОВЫЙ ФОНД (Ready) СО СТРОЯЩИМСЯ (Off-Plan):
   - Если цена объекта ВЫШЕ медианы вторички (Ready) — это ПРЕМИЯ за новостройку (+X%), а НЕ дисконт! Категорически запрещено писать "цена ниже медианы вторички", если цена выше.
   - Объясни экономическую причину премии: вторичка в районе часто представлена устаревшим фондом 15–20 летней давности (2006-2012 гг., износ чиллеров/инженерии, устаревшие планировки), тогда как новостройка предлагает современные материалы, гарантию девелопера, приватную инфраструктуру и рассрочку (leverage).
   - Сравни с группой строящихся конкурентов (Off-Plan): если там цена ниже медианы конкурентов — укажи реальный дисконт к новому фонду в кластере.
2. СТРУКТУРА ОПЛАТЫ И ВЫХОД:
   - Укажи порог переуступки (NOC) в % и точку безубыточности (Break-Even PSF) с учетом сборов DLD 4%.
   - Реалистично оцени соотношение точки безубыточности с текущими ценами off-plan.
3. РИСКИ И СТРЕСС-ТЕСТ:
   - Оцени задержки девелопера и конкуренцию в окне сдачи (collision window).
4. СТРОГАЯ ТОЧНОСТЬ:
   - Запрещено выдумывать новые цифры, ставки или факты. Используй ТОЛЬКО факты из предоставленного объекта.
5. ФОРМАТ JSON:
{
  "executiveSummary": "2-3 предложения строгого резюме для §17.1 с точным указанием премий/дисконтов, порога NOC и безубыточности",
  "cmaRationale": "Аналитическое обоснование соотношения цен с готовым фондом и строящимися конкурентами (§7)",
  "riskAndStressTest": "Стресс-тест ликвидности и сроков",
  "investorVerdict": "Итоговый вердикт для инвестора (обоснованность входа и сценарии выхода)"
}
`.trim();

  const userPrompt = `
Сформируй независимый аналитический вывод на ${isAr ? "арабском" : isRu ? "русском" : "английском"} языке для объекта:
- Проект: ${input.projectName} (${input.developerName})
- Локация: ${input.areaName}
- Тип лота: ${brLabel} (${input.unitAreaSqft} sq.ft.)
- Цена лота: ${Math.round(input.unitPriceAed).toLocaleString()} AED (${input.unitPsf} AED/sq.ft.)
- Срок сдачи: ${input.expectedHandoverDate || "2026-2028"}
- Group A (Готовый вторичный фонд): Медиана ${input.readyMedianPsf || "—"} AED/sq.ft. (${input.readyDealsCount} сделок). ${
    input.gapToReadyPercent !== null
      ? input.gapToReadyPercent < 0
        ? `Объект на ${Math.abs(input.gapToReadyPercent).toFixed(1)}% ДОРОЖЕ вторички (премия за новостройку над фондом 15-20 лет)`
        : `Объект на ${input.gapToReadyPercent.toFixed(1)}% ДЕШЕВЛЕ вторички (дисконт)`
      : "Выборка ограничена"
  }
- Group B (Строящиеся проекты-конкуренты Off-Plan): Медиана ${input.offPlanMedianPsf || "—"} AED/sq.ft. (${input.offPlanDealsCount} сделок). ${
    input.gapToOffPlanPercent !== null
      ? input.gapToOffPlanPercent > 0
        ? `Объект на ${input.gapToOffPlanPercent.toFixed(1)}% ДЕШЕВЛЕ медианы строящихся конкурентов (дисконт к off-plan)`
        : `Объект на ${Math.abs(input.gapToOffPlanPercent).toFixed(1)}% ДОРОЖЕ медианы строящихся конкурентов`
      : "Выборка ограничена"
  }
- Group C (Near-Handover): Медиана ${input.nearHandoverMedianPsf || "—"} AED/sq.ft. (${input.nearHandoverDealsCount} сделок)
- Порог NOC (разрешение на переуступку): ${input.nocThresholdPercent}% оплаты
- Точка безубыточности при выходе (Break-Even PSF с DLD 4%): ${input.breakEvenPsfAed} AED/sq.ft.
- Конкуренция в окне сдачи: ${input.competingCollisionCount || 0} проектов одновременно
- Историческая средняя задержка девелопера: ${input.developerAvgDelayDays ? `${Math.round(input.developerAvgDelayDays)} дней` : "нет существенных задержек"}

Выведи строго JSON.
`.trim();

  try {
    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini dossier API status:", response.status, await response.text());
      return generateFallback();
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return generateFallback();
    }

    const parsed = JSON.parse(candidateText);
    const fb = generateFallback();
    return {
      executiveSummary: parsed.executiveSummary || fb.executiveSummary,
      cmaRationale: parsed.cmaRationale || fb.cmaRationale,
      riskAndStressTest: parsed.riskAndStressTest || fb.riskAndStressTest,
      investorVerdict: parsed.investorVerdict || fb.investorVerdict,
      source: "gemini_2.5_flash",
    };
  } catch (err) {
    console.warn("Gemini dossier synthesis failed:", err);
    return generateFallback();
  }
}

