// supabase/functions/revalidate-news/index.ts
// Re-procesa noticias que quedaron sin validar por Gemini (unverified | NULL | confidence=0).
// Invocable manualmente o vía cron.
//
// Query params:
//   ?limit=50         (default 50, max 100) — cuántas procesar en esta corrida
//   ?dry_run=1        — no hace UPDATE, solo simula

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

interface NewsRow {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  country_code: string | null;
  source_label: string | null;
  published_at: string | null;
}

interface Verdict {
  verdict: "real" | "misleading" | "fake" | "unverified";
  confidence: number;
  reasoning: string;
  sponsored: boolean;
  sponsored_by: string | null;
  sponsored_reasoning: string | null;
}

async function callGemini(news: NewsRow, paragraphs: string[], sources: Array<{ name: string; bias?: string; credibility?: number }>): Promise<Verdict> {
  const contentPreview = paragraphs.length > 0 ? paragraphs.slice(0, 3).join("\n").substring(0, 800) : (news.description || "");
  const currentDate = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const country = news.country_code === "VE" ? "Venezuela" : news.country_code === "CO" ? "Colombia" : "Internacional (Tecnología)";

  const prompt = `Eres un verificador de noticias profesional especializado en América Latina (Venezuela y Colombia).

CONTEXTO ACTUAL IMPORTANTE (usa esto como referencia, NO tu conocimiento previo):
- Fecha actual: ${currentDate}
- Estamos en el año ${currentYear}.
- Presidente de EE.UU.: Donald Trump.
- Presidenta interina de Venezuela: Delcy Rodríguez (asumió tras el arresto de Nicolás Maduro por EEUU el 3 de enero de 2026).
- Presidente de Colombia: Gustavo Petro.
- NO marques una noticia como engañosa o falsa basándote en que eventos o cargos políticos "no coinciden con tu conocimiento". Usa el contexto proporcionado aquí.

Analiza esta noticia y determina su veracidad.

NOTICIA:
- Título: ${news.title}
- Fuente: ${news.source_label || "Desconocida"}
- País: ${country}
- Categoría: ${news.category || "—"}
- Fecha: ${news.published_at || "—"}
- Contenido: ${contentPreview}

FUENTES DISPONIBLES: ${sources.length}
${sources.slice(0, 5).map(s => `- ${s.name} (sesgo: ${s.bias || "—"}, cred: ${s.credibility || "—"}/100)`).join("\n")}

INSTRUCCIONES:
1. Evalúa si la noticia es coherente y plausible para el contexto actual del país.
2. NO la marques falsa solo porque menciona cargos o eventos que no coinciden con tu entrenamiento.
3. Si la información es ambigua o no se puede corroborar, prefiere "misleading" antes que "unverified".
4. Solo usa "unverified" si literalmente no hay forma de evaluar (datos ilegibles, idioma desconocido, contenido vacío).
5. Detecta señales de patrocinio/propaganda.

Responde ÚNICAMENTE en JSON válido:
{"verdict":"real","confidence":85,"reasoning":"Explicación breve en español","sponsored":false,"sponsored_by":null,"sponsored_reasoning":null}`;

  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
    }),
  });

  if (!resp.ok) {
    return { verdict: "unverified", confidence: 0, reasoning: `Gemini HTTP ${resp.status}`, sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
    return { verdict: "unverified", confidence: 0, reasoning: "Respuesta vacía de Gemini", sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }

  let cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleanText.indexOf("{");
  const jsonEnd = cleanText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { verdict: "unverified", confidence: 0, reasoning: "No se pudo extraer JSON de Gemini", sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }
  cleanText = cleanText.substring(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(cleanText);
    return {
      verdict: parsed.verdict || "unverified",
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || "Sin razonamiento").substring(0, 500),
      sponsored: Boolean(parsed.sponsored),
      sponsored_by: parsed.sponsored_by ? String(parsed.sponsored_by).substring(0, 200) : null,
      sponsored_reasoning: parsed.sponsored_reasoning ? String(parsed.sponsored_reasoning).substring(0, 500) : null,
    };
  } catch (e) {
    return { verdict: "unverified", confidence: 0, reasoning: `Error parsing JSON: ${e}`, sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const dryRun = url.searchParams.get("dry_run") === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Selecciona news unverified o NULL
  const { data: rows, error: selectErr } = await supabase
    .from("news")
    .select("id, title, description, category, country_code, source_label, published_at")
    .or("gemini_validated.eq.false,gemini_verdict.is.null,gemini_verdict.eq.unverified")
    .in("country_code", ["VE", "CO", "TECH"])
    .order("published_at", { ascending: false })
    .limit(limit);

  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, message: "No hay noticias para revalidar" }), { headers: { "Content-Type": "application/json" } });
  }

  const results: Array<{ id: number; verdict: string; confidence: number; reasoning: string }> = [];
  let success = 0;
  let failed = 0;

  for (const news of rows as NewsRow[]) {
    try {
      // Fetch paragraphs + sources
      const [{ data: paragraphs }, { data: sources }] = await Promise.all([
        supabase.from("article_paragraphs").select("content").eq("news_id", news.id).order("sort_order", { ascending: true }),
        supabase.from("news_sources").select("name, bias, credibility").eq("news_id", news.id),
      ]);

      const paragTexts = (paragraphs || []).map((p: any) => p.content as string);
      const srcs = (sources || []) as Array<{ name: string; bias?: string; credibility?: number }>;

      const verdict = await callGemini(news, paragTexts, srcs);

      if (!dryRun && verdict.confidence > 0) {
        const veracityMap: Record<string, string> = {
          real: "verificada",
          misleading: "parcialmente_falsa",
          fake: "fake",
          unverified: "verificada",
        };

        const { error: updErr } = await supabase
          .from("news")
          .update({
            gemini_validated: true,
            gemini_verdict: verdict.verdict,
            gemini_confidence: verdict.confidence,
            gemini_reasoning: verdict.sponsored
              ? `${verdict.reasoning} | PATROCINADA: ${verdict.sponsored_reasoning}`
              : verdict.reasoning,
            gemini_validated_at: new Date().toISOString(),
            veracity: veracityMap[verdict.verdict] || "verificada",
            veracity_detail: verdict.reasoning,
            sponsored_flag: verdict.sponsored ? verdict.sponsored_by : null,
          })
          .eq("id", news.id);

        if (updErr) {
          failed++;
          results.push({ id: news.id, verdict: "ERROR", confidence: 0, reasoning: `Update failed: ${updErr.message}` });
        } else {
          success++;
          results.push({ id: news.id, verdict: verdict.verdict, confidence: verdict.confidence, reasoning: verdict.reasoning.substring(0, 100) });
        }
      } else if (verdict.confidence === 0) {
        failed++;
        results.push({ id: news.id, verdict: "FAILED", confidence: 0, reasoning: verdict.reasoning });
      } else {
        // dry run
        results.push({ id: news.id, verdict: verdict.verdict, confidence: verdict.confidence, reasoning: verdict.reasoning.substring(0, 100) });
      }
    } catch (e) {
      failed++;
      results.push({ id: news.id, verdict: "ERROR", confidence: 0, reasoning: String(e).substring(0, 200) });
    }

    // Rate limiting Gemini
    await delay(800);
  }

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    processed: rows.length,
    success,
    failed,
    results,
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
