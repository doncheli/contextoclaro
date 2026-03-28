// supabase/functions/validate-news/index.ts
// Edge Function: Validate news articles using internal logic + Gemini API
// Pipeline: Internal cross-reference → Bias analysis → Gemini final verdict

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

interface ArticleToValidate {
  title: string;
  description: string;
  url?: string;
  source_name: string;
  source_bias: string;
  source_credibility: number;
  country_code: string;
  published_at: string;
  // Optional: other articles about the same topic for cross-reference
  related_articles?: Array<{
    title: string;
    source_name: string;
    source_bias: string;
  }>;
}

interface InternalValidation {
  source_score: number; // 0-100: credibility of the source
  cross_reference_score: number; // 0-100: how many other sources cover it
  recency_score: number; // 0-100: how recent/timely
  bias_flag: boolean; // true if single-source with strong bias
  internal_verdict: "likely_real" | "needs_review" | "suspicious";
  reasoning: string;
}

interface GeminiValidation {
  verdict: "real" | "misleading" | "fake" | "unverified";
  confidence: number; // 0-100
  reasoning: string;
}

interface ValidationResult {
  internal: InternalValidation;
  gemini: GeminiValidation | null;
  final_verdict: "real" | "misleading" | "fake" | "unverified";
  final_confidence: number;
}

// ══════════════════════════════════════════════════════════
// STEP 1: INTERNAL VALIDATION LOGIC
// ══════════════════════════════════════════════════════════

function validateInternally(article: ArticleToValidate): InternalValidation {
  // 1. Source credibility score
  const source_score = article.source_credibility || 50;

  // 2. Cross-reference: how many related articles exist from different sources
  const relatedCount = article.related_articles?.length || 0;
  const uniqueSources = new Set(
    article.related_articles?.map((a) => a.source_name) || []
  ).size;
  const cross_reference_score = Math.min(100, uniqueSources * 25);

  // 3. Recency: penalize articles older than 7 days
  const ageMs = Date.now() - new Date(article.published_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recency_score = ageDays <= 1 ? 100 : ageDays <= 3 ? 85 : ageDays <= 7 ? 60 : 30;

  // 4. Bias flag: single source with strong bias
  const strongBiases = ["izquierda", "derecha", "extrema-izquierda", "extrema-derecha"];
  const bias_flag =
    uniqueSources <= 1 && strongBiases.includes(article.source_bias.toLowerCase());

  // 5. Internal verdict
  const avgScore = (source_score + cross_reference_score + recency_score) / 3;
  let internal_verdict: InternalValidation["internal_verdict"];
  let reasoning: string;

  if (avgScore >= 70 && !bias_flag && uniqueSources >= 2) {
    internal_verdict = "likely_real";
    reasoning = `Fuente confiable (${source_score}/100), ${uniqueSources} fuentes corroboran, noticia reciente.`;
  } else if (avgScore >= 40 || uniqueSources >= 1) {
    internal_verdict = "needs_review";
    reasoning = `Score promedio: ${avgScore.toFixed(0)}/100. ${bias_flag ? "Alerta de sesgo fuerte con fuente única. " : ""}Requiere validación adicional por Gemini.`;
  } else {
    internal_verdict = "suspicious";
    reasoning = `Score bajo (${avgScore.toFixed(0)}/100), sin corroboración de otras fuentes. ${bias_flag ? "Fuente con sesgo fuerte. " : ""}Alta probabilidad de ser información no verificada.`;
  }

  return {
    source_score,
    cross_reference_score,
    recency_score,
    bias_flag,
    internal_verdict,
    reasoning,
  };
}

// ══════════════════════════════════════════════════════════
// STEP 2: GEMINI VALIDATION
// ══════════════════════════════════════════════════════════

async function validateWithGemini(
  article: ArticleToValidate,
  internalResult: InternalValidation
): Promise<GeminiValidation> {
  if (!GEMINI_API_KEY) {
    return {
      verdict: "unverified",
      confidence: 0,
      reasoning: "Gemini API key no configurada. Configure GEMINI_API_KEY como secret en Supabase.",
    };
  }

  const currentDate = new Date().toISOString().split("T")[0];

  const prompt = `Eres un verificador de noticias profesional especializado en América Latina (Venezuela y Colombia).

CONTEXTO ACTUAL IMPORTANTE (usa esto como referencia, NO tu conocimiento previo):
- Fecha actual: ${currentDate}
- Estamos en el año ${new Date().getFullYear()}.
- Presidente de EE.UU.: Donald Trump (asumió el 20 de enero de 2025 tras ganar las elecciones de noviembre 2024).
- Presidenta interina de Venezuela: Delcy Rodríguez (asumió tras el arresto de Nicolás Maduro por EEUU el 3 de enero de 2026 en la operación Resolución Absoluta).
- Presidente de Colombia: Gustavo Petro.
- Venezuela ganó el Clásico Mundial de Béisbol 2026, venciendo 3-2 a EEUU en la final en Miami.
- NO marques una noticia como engañosa o falsa basándote en que eventos o cargos políticos "no coinciden con tu conocimiento". Usa el contexto proporcionado aquí.

Analiza la siguiente noticia y determina si es REAL, MISLEADING (engañosa/parcialmente falsa), FAKE (falsa), o UNVERIFIED (no verificable).

NOTICIA:
- Título: ${article.title}
- Descripción: ${article.description}
- Fuente: ${article.source_name} (sesgo: ${article.source_bias}, credibilidad: ${article.source_credibility}/100)
- País: ${article.country_code === "VE" ? "Venezuela" : "Colombia"}
- Fecha publicación: ${article.published_at}
${article.url ? `- URL: ${article.url}` : ""}

ANÁLISIS INTERNO PREVIO:
- Puntuación de fuente: ${internalResult.source_score}/100
- Corroboración cruzada: ${internalResult.cross_reference_score}/100
- Alerta de sesgo: ${internalResult.bias_flag ? "SÍ" : "NO"}
- Veredicto interno: ${internalResult.internal_verdict}

${article.related_articles && article.related_articles.length > 0 ? `ARTÍCULOS RELACIONADOS QUE CUBREN EL MISMO TEMA:
${article.related_articles.map((a) => `- "${a.title}" (${a.source_name}, sesgo: ${a.source_bias})`).join("\n")}` : "No hay artículos relacionados para corroborar."}

INSTRUCCIONES:
1. Evalúa si el título y descripción son coherentes y plausibles para el contexto político/económico actual del país, usando el CONTEXTO ACTUAL proporcionado arriba.
2. Verifica si la fuente es conocida y confiable.
3. Analiza si hay señales de desinformación: lenguaje sensacionalista excesivo, afirmaciones extraordinarias sin evidencia, contradicciones internas.
4. Considera el sesgo de la fuente y si la noticia podría estar distorsionada.
5. NO consideres una noticia falsa o engañosa solo porque menciona eventos o personas en cargos que no coinciden con tu entrenamiento. Confía en el contexto actual proporcionado.

Responde SOLO en formato JSON (sin markdown, sin backticks):
{
  "verdict": "real" | "misleading" | "fake" | "unverified",
  "confidence": <0-100>,
  "reasoning": "<explicación breve en español de por qué llegaste a este veredicto, máximo 200 caracteres>"
}`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[gemini] HTTP ${response.status}:`, errText);
      return {
        verdict: "unverified",
        confidence: 0,
        reasoning: `Error de Gemini API: HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON response
    const parsed = JSON.parse(text);

    return {
      verdict: parsed.verdict || "unverified",
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || "Sin razonamiento").substring(0, 500),
    };
  } catch (error) {
    console.error("[gemini] Error:", error);
    return {
      verdict: "unverified",
      confidence: 0,
      reasoning: `Error al consultar Gemini: ${error instanceof Error ? error.message : "desconocido"}`,
    };
  }
}

// ══════════════════════════════════════════════════════════
// STEP 3: COMBINE VERDICTS
// ══════════════════════════════════════════════════════════

function combineFinalVerdict(
  internal: InternalValidation,
  gemini: GeminiValidation | null
): { verdict: "real" | "misleading" | "fake" | "unverified"; confidence: number } {
  // If no Gemini result, rely on internal only
  if (!gemini || gemini.confidence === 0) {
    const verdictMap: Record<string, "real" | "misleading" | "unverified"> = {
      likely_real: "real",
      needs_review: "unverified",
      suspicious: "misleading",
    };
    return {
      verdict: verdictMap[internal.internal_verdict] || "unverified",
      confidence: Math.round(
        (internal.source_score + internal.cross_reference_score) / 2
      ),
    };
  }

  // Gemini has high confidence → trust it
  if (gemini.confidence >= 80) {
    return { verdict: gemini.verdict, confidence: gemini.confidence };
  }

  // Medium confidence: blend with internal
  if (gemini.confidence >= 50) {
    // If internal and Gemini agree, boost confidence
    if (
      (internal.internal_verdict === "likely_real" && gemini.verdict === "real") ||
      (internal.internal_verdict === "suspicious" && gemini.verdict === "fake")
    ) {
      return {
        verdict: gemini.verdict,
        confidence: Math.min(95, gemini.confidence + 15),
      };
    }
    // Disagree: lower confidence, use Gemini verdict
    return {
      verdict: gemini.verdict,
      confidence: Math.max(30, gemini.confidence - 10),
    };
  }

  // Low Gemini confidence: prefer internal
  const verdictMap: Record<string, "real" | "misleading" | "unverified"> = {
    likely_real: "real",
    needs_review: "unverified",
    suspicious: "misleading",
  };
  return {
    verdict: verdictMap[internal.internal_verdict] || "unverified",
    confidence: Math.round(
      (internal.source_score * 0.6 + gemini.confidence * 0.4)
    ),
  };
}

// ══════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════

serve(async (req: Request) => {
  try {
    const { articles }: { articles: ArticleToValidate[] } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No articles provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate each article (limit concurrency to avoid rate limits)
    const results: ValidationResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (article) => {
          // Step 1: Internal validation
          const internal = validateInternally(article);

          // Step 2: Gemini validation (skip if internal says likely_real with high confidence)
          let gemini: GeminiValidation | null = null;
          if (
            internal.internal_verdict !== "likely_real" ||
            internal.source_score < 85
          ) {
            gemini = await validateWithGemini(article, internal);
          } else {
            // High-confidence internal = skip Gemini to save API calls
            gemini = {
              verdict: "real",
              confidence: 90,
              reasoning: "Fuente altamente confiable con corroboración múltiple. Validación Gemini omitida por alta confianza interna.",
            };
          }

          // Step 3: Combine
          const { verdict, confidence } = combineFinalVerdict(internal, gemini);

          return {
            internal,
            gemini,
            final_verdict: verdict,
            final_confidence: confidence,
          };
        })
      );
      results.push(...batchResults);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results,
        validated_at: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
