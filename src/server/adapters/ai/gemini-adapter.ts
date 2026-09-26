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
