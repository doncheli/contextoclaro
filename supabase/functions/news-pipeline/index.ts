// supabase/functions/news-pipeline/index.ts
// Edge Function: Orchestrator — Scrape → Fetch full content → Validate → Insert
// Invokable via cron schedule or manual trigger

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

function getGeminiUrl(): string {
  const key = Deno.env.get("GEMINI_API_KEY") || "";
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

function getGeminiApiKey(): string {
  return Deno.env.get("GEMINI_API_KEY") || "";
}

// ══════════════════════════════════════════════════════════
// RSS FEEDS
// ══════════════════════════════════════════════════════════

const RSS_FEEDS = {
  VE: [
    { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/", bias: "centro", credibility: 88 },
    { name: "El Nacional", url: "https://www.elnacional.com/feed/", bias: "centro-derecha", credibility: 80 },
    { name: "La Patilla", url: "https://www.lapatilla.com/feed/", bias: "centro-derecha", credibility: 75 },
    { name: "Correo del Caroní", url: "https://correodelcaroni.com/feed/", bias: "centro", credibility: 85 },
    { name: "Runrunes", url: "https://runrun.es/feed/", bias: "centro", credibility: 82 },
  ],
  CO: [
    { name: "El Tiempo", url: "https://www.eltiempo.com/rss/titulares.xml", bias: "centro", credibility: 88 },
    { name: "Infobae Colombia", url: "https://www.infobae.com/feeds/rss/colombia/", bias: "centro-derecha", credibility: 83 },
    { name: "Semana", url: "https://www.semana.com/rss", bias: "centro-derecha", credibility: 82 },
    { name: "El Espectador", url: "https://www.elespectador.com/rss", bias: "centro-izquierda", credibility: 85 },
    { name: "La Silla Vacía", url: "https://www.lasillavacia.com/feed/", bias: "centro", credibility: 92 },
  ],
  TECH: [
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", bias: "centro", credibility: 88 },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", bias: "centro", credibility: 92 },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", bias: "centro", credibility: 85 },
    { name: "Wired", url: "https://www.wired.com/feed/rss", bias: "centro-izquierda", credibility: 88 },
    { name: "Xataka", url: "https://www.xataka.com/feedburner.xml", bias: "centro", credibility: 84 },
    { name: "Hipertextual", url: "https://hipertextual.com/feed", bias: "centro", credibility: 82 },
  ],
};

// ══════════════════════════════════════════════════════════
// RSS PARSING
// ══════════════════════════════════════════════════════════

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  image?: string;
  category?: string;
  contentEncoded?: string;
}

interface ScrapedArticle {
  title: string;
  description: string;
  url: string;
  image?: string;
  category: string;
  country: string;
  country_code: string;
  source_name: string;
  source_bias: string;
  source_credibility: number;
  published_at: string;
  full_content?: string;
  paragraphs: string[];
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : "";
}

function isJunkImage(url: string): boolean {
  return url.includes("googleusercontent.com") || url.includes("gstatic.com/generate") || url.length < 20;
}

function extractImage(xml: string): string | undefined {
  const mediaMatch = xml.match(/url="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
  if (mediaMatch && !isJunkImage(mediaMatch[1])) return mediaMatch[1];
  const encMatch = xml.match(/<enclosure[^>]+url="(https?:\/\/[^"]+)"/);
  if (encMatch && !isJunkImage(encMatch[1])) return encMatch[1];
  const imgMatch = xml.match(/<img[^>]+src="(https?:\/\/[^"]+)"/);
  if (imgMatch && !isJunkImage(imgMatch[1])) return imgMatch[1];
  return undefined;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const x = m[1];
    const title = extractTag(x, "title");
    const link = extractTag(x, "link");
    if (title && link) {
      // Try content:encoded first (full article in RSS)
      const contentEncoded = extractTag(x, "content:encoded") || extractTag(x, "content");
      items.push({
        title,
        description: extractTag(x, "description").replace(/<[^>]+>/g, "").substring(0, 500),
        link,
        pubDate: extractTag(x, "pubDate"),
        image: extractImage(x),
        category: extractTag(x, "category"),
        contentEncoded,
      });
    }
  }
  return items;
}

// ══════════════════════════════════════════════════════════
// HTML → TEXT EXTRACTION (for full article body)
// ══════════════════════════════════════════════════════════

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractArticleContent(html: string): string[] {
  // Try to find article body in common patterns
  const articlePatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*(?:entry-content|article-body|post-content|story-body|nota-cuerpo|contenido|article__body|single-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:article-body|post-content|story-content|nota-cuerpo)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let bodyHtml = "";
  for (const pattern of articlePatterns) {
    const match = html.match(pattern);
    if (match) {
      bodyHtml = match[1] || match[0];
      break;
    }
  }

  // Fallback: extract all <p> tags from the page
  if (!bodyHtml) {
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(html)) !== null) {
      const text = pMatch[1].replace(/<[^>]+>/g, "").trim();
      if (text.length > 40) paragraphs.push(text);
    }
    if (paragraphs.length >= 2) return paragraphs.slice(0, 20);
  }

  // Convert body HTML to text paragraphs
  const text = htmlToText(bodyHtml);
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

  return paragraphs.slice(0, 20);
}

// ══════════════════════════════════════════════════════════
// FETCH FULL ARTICLE CONTENT
// ══════════════════════════════════════════════════════════

function extractOgImage(html: string): string | undefined {
  // Try og:image meta tag
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="(https?:\/\/[^"]+)"/i)
    || html.match(/<meta[^>]+content="(https?:\/\/[^"]+)"[^>]+property="og:image"/i);
  if (ogMatch) return ogMatch[1];

  // Try twitter:image
  const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="(https?:\/\/[^"]+)"/i)
    || html.match(/<meta[^>]+content="(https?:\/\/[^"]+)"[^>]+name="twitter:image"/i);
  if (twMatch) return twMatch[1];

  // Try first large image in article
  const imgMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
  if (imgMatch) return imgMatch[1];

  return undefined;
}

async function fetchArticleContent(url: string): Promise<{ paragraphs: string[]; image?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LatamInsight-Bot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-LA,es;q=0.9",
      },
    });
    clearTimeout(t);
    if (!resp.ok) {
      console.warn(`[fetch-content] ${url}: HTTP ${resp.status}`);
      return { paragraphs: [] };
    }
    const html = await resp.text();
    const paragraphs = extractArticleContent(html);
    const image = extractOgImage(html);
    return { paragraphs, image };
  } catch (e) {
    console.warn(`[fetch-content] ${url}: ${e}`);
    return { paragraphs: [] };
  }
}

// ══════════════════════════════════════════════════════════
// SCRAPE FEEDS + FETCH CONTENT
// ══════════════════════════════════════════════════════════

async function scrapeFeed(
  feed: { name: string; url: string; bias: string; credibility: number },
  countryKey: string
): Promise<ScrapedArticle[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(feed.url, { signal: ctrl.signal, headers: { "User-Agent": "LatamInsight-Bot/1.0" } });
    clearTimeout(t);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items = parseRss(xml);
    const emojiMap: Record<string, string> = { VE: "🇻🇪", CO: "🇨🇴", TECH: "🌐" };
    const nameMap: Record<string, string> = { VE: "VENEZUELA", CO: "COLOMBIA", TECH: "TECNOLOGÍA" };
    const emoji = emojiMap[countryKey] || "🌐";
    const countryName = nameMap[countryKey] || "GLOBAL";

    return items.slice(0, 8).map((item) => {
      // Extract paragraphs from RSS content:encoded if available
      let paragraphs: string[] = [];
      if (item.contentEncoded && item.contentEncoded.length > 100) {
        paragraphs = extractArticleContent(`<div>${item.contentEncoded}</div>`);
      }

      return {
        title: item.title,
        description: item.description,
        url: item.link,
        image: item.image,
        category: countryKey === "TECH"
          ? "TECNOLOGÍA"
          : `${countryName} · ${item.category || "GENERAL"}`.toUpperCase(),
        country: emoji,
        country_code: countryKey,
        source_name: feed.name,
        source_bias: feed.bias,
        source_credibility: feed.credibility,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        paragraphs,
      };
    });
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// CROSS-REFERENCE
// ══════════════════════════════════════════════════════════

function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-záéíóúñ\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function findRelatedArticles(article: ScrapedArticle, allArticles: ScrapedArticle[]): ScrapedArticle[] {
  const words = normalizeTitle(article.title);
  if (words.length === 0) return [];
  return allArticles.filter((other) => {
    if (other.url === article.url) return false;
    if (other.source_name === article.source_name) return false;
    const otherWords = normalizeTitle(other.title);
    const overlap = words.filter((w) => otherWords.includes(w)).length;
    return overlap >= Math.min(3, Math.ceil(words.length * 0.4));
  });
}

// ══════════════════════════════════════════════════════════
// INTERNAL VALIDATION
// ══════════════════════════════════════════════════════════

interface InternalValidation {
  source_score: number;
  cross_reference_score: number;
  bias_flag: boolean;
  internal_verdict: "likely_real" | "needs_review" | "suspicious";
}

function validateInternally(article: ScrapedArticle, related: ScrapedArticle[]): InternalValidation {
  const source_score = article.source_credibility || 50;
  const uniqueSources = new Set(related.map((a) => a.source_name)).size;
  const cross_reference_score = Math.min(100, uniqueSources * 25);
  const strongBiases = ["izquierda", "derecha"];
  const bias_flag = uniqueSources <= 1 && strongBiases.includes(article.source_bias);
  const avg = (source_score + cross_reference_score) / 2;
  const internal_verdict =
    avg >= 70 && !bias_flag && uniqueSources >= 2
      ? ("likely_real" as const)
      : avg >= 40
        ? ("needs_review" as const)
        : ("suspicious" as const);
  return { source_score, cross_reference_score, bias_flag, internal_verdict };
}

// ══════════════════════════════════════════════════════════
// GEMINI VALIDATION (always runs)
// ══════════════════════════════════════════════════════════

interface GeminiResult {
  verdict: "real" | "misleading" | "fake" | "unverified";
  confidence: number;
  reasoning: string;
  sponsored: boolean;
  sponsored_by: string | null;
  sponsored_reasoning: string | null;
}

async function validateWithGemini(
  article: ScrapedArticle,
  internal: InternalValidation,
  related: ScrapedArticle[]
): Promise<GeminiResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error("[gemini] GEMINI_API_KEY is not set!");
    return { verdict: "unverified", confidence: 0, reasoning: "GEMINI_API_KEY no configurada", sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }

  const geminiUrl = getGeminiUrl();
  const contentPreview = article.paragraphs.length > 0
    ? article.paragraphs.slice(0, 3).join("\n").substring(0, 800)
    : article.description;

  const currentDate = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();

  const prompt = `Eres un verificador de noticias profesional especializado en América Latina (Venezuela y Colombia).

CONTEXTO ACTUAL IMPORTANTE (usa esto como referencia, NO tu conocimiento previo):
- Fecha actual: ${currentDate}
- Estamos en el año ${currentYear}.
- Presidente de EE.UU.: Donald Trump (asumió el 20 de enero de 2025 tras ganar las elecciones de noviembre 2024).
- Presidenta interina de Venezuela: Delcy Rodríguez (asumió tras el arresto de Nicolás Maduro por EEUU el 3 de enero de 2026 en la operación Resolución Absoluta).
- Presidente de Colombia: Gustavo Petro.
- Venezuela ganó el Clásico Mundial de Béisbol 2026, venciendo 3-2 a EEUU en la final en Miami.
- NO marques una noticia como engañosa o falsa basándote en que eventos o cargos políticos "no coinciden con tu conocimiento". Usa el contexto proporcionado aquí.

Analiza esta noticia y determina su veracidad.

NOTICIA:
- Título: ${article.title}
- Fuente: ${article.source_name} (sesgo: ${article.source_bias}, credibilidad: ${article.source_credibility}/100)
- País: ${article.country_code === "VE" ? "Venezuela" : article.country_code === "CO" ? "Colombia" : "Internacional (Tecnología)"}
- Fecha: ${article.published_at}
- Contenido: ${contentPreview}

ANÁLISIS INTERNO:
- Score fuente: ${internal.source_score}/100
- Corroboración cruzada: ${internal.cross_reference_score}/100 (${related.length} fuentes)
- Alerta sesgo: ${internal.bias_flag ? "SÍ" : "NO"}

${related.length > 0 ? `FUENTES QUE CORROBORAN:\n${related.slice(0, 5).map((r) => `- "${r.title}" (${r.source_name})`).join("\n")}` : "Sin corroboración de otras fuentes."}

INSTRUCCIONES:
1. Evalúa si la noticia es coherente y plausible para el contexto actual del país.
2. NO consideres una noticia falsa solo porque menciona cargos o eventos que no coinciden con tu entrenamiento. Confía en el contexto proporcionado.
3. Analiza señales de desinformación: sensacionalismo, afirmaciones sin evidencia, contradicciones internas.
4. DETECCIÓN DE PATROCINIO: Analiza si la noticia parece ser contenido patrocinado, pagado, propaganda o comunicado de prensa disfrazado de noticia. Señales a buscar:
   - Lenguaje promocional o excesivamente favorable hacia un político, partido, gobierno, empresa o persona específica
   - Ausencia de fuentes independientes o críticas
   - Tono de comunicado de prensa o relaciones públicas
   - Beneficia claramente la imagen de un actor político/económico sin contrapeso periodístico
   - Contenido que parece campaña electoral o propaganda gubernamental
   - Noticias que solo repiten declaraciones oficiales sin verificación ni contexto

Responde ÚNICAMENTE en JSON válido:
{"verdict":"real","confidence":85,"reasoning":"Explicación breve en español","sponsored":false,"sponsored_by":null,"sponsored_reasoning":null}

Campos:
- verdict: "real", "misleading", "fake", "unverified"
- confidence: 0-100
- reasoning: explicación breve del veredicto en español
- sponsored: true si detectas que es contenido patrocinado/pagado/propaganda, false si no
- sponsored_by: si sponsored=true, indica quién se beneficia (ej: "Gobierno de Venezuela", "Partido X", "Empresa Y", "Campaña de [político]"). null si no es patrocinada
- sponsored_reasoning: si sponsored=true, explica brevemente por qué crees que es patrocinada (max 200 chars). null si no es patrocinada`;

  try {
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error(`[gemini] HTTP ${resp.status}: ${errText.substring(0, 200)}`);
      return { verdict: "unverified", confidence: 0, reasoning: `Gemini HTTP ${resp.status}`, sponsored: false, sponsored_by: null, sponsored_reasoning: null };
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.error("[gemini] Empty response from Gemini");
      return { verdict: "unverified", confidence: 0, reasoning: "Respuesta vacía de Gemini", sponsored: false, sponsored_by: null, sponsored_reasoning: null };
    }

    // Strip markdown code fences and extract JSON
    let cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Try to find JSON object
    const jsonStart = cleanText.indexOf("{");
    const jsonEnd = cleanText.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("[gemini] No JSON found in response:", text.substring(0, 200));
      return { verdict: "unverified", confidence: 0, reasoning: "No se pudo extraer JSON de Gemini", sponsored: false, sponsored_by: null, sponsored_reasoning: null };
    }
    cleanText = cleanText.substring(jsonStart, jsonEnd + 1);

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
    console.error(`[gemini] Error: ${e}`);
    return { verdict: "unverified", confidence: 0, reasoning: `Error Gemini: ${e}`, sponsored: false, sponsored_by: null, sponsored_reasoning: null };
  }
}

// Small delay to avoid Gemini rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════
// DEDUPLICATION
// ══════════════════════════════════════════════════════════

async function getExistingTitles(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const { data } = await supabase.from("news").select("title").order("published_at", { ascending: false }).limit(300);
  const titles = new Set<string>();
  data?.forEach((row: { title: string }) => {
    titles.add(row.title.toLowerCase().trim().substring(0, 80));
  });
  return titles;
}

// ══════════════════════════════════════════════════════════
// BIAS ESTIMATION
// ══════════════════════════════════════════════════════════

function estimateBias(
  article: ScrapedArticle,
  related: ScrapedArticle[]
): { left: number; center: number; right: number; label: string } {
  const allSources = [article, ...related];
  let left = 0, center = 0, right = 0;
  allSources.forEach((s) => {
    const b = (s.source_bias || "centro").toLowerCase();
    if (b.includes("izquierda") && !b.includes("centro")) left += 1;
    else if (b.includes("izquierda") && b.includes("centro")) { left += 0.5; center += 0.5; }
    else if (b.includes("derecha") && !b.includes("centro")) right += 1;
    else if (b.includes("derecha") && b.includes("centro")) { right += 0.5; center += 0.5; }
    else center += 1;
  });
  const total = left + center + right || 1;
  const pLeft = Math.round((left / total) * 100);
  const pRight = Math.round((right / total) * 100);
  const pCenter = Math.max(0, 100 - pLeft - pRight);
  const label = pLeft > 50 ? "IZQUIERDA" : pRight > 50 ? "DERECHA" : Math.abs(pLeft - pRight) <= 20 ? "EQUILIBRADO" : "CENTRO";
  return { left: pLeft, center: pCenter, right: pRight, label };
}

// ══════════════════════════════════════════════════════════
// INSERT INTO DB (with paragraphs)
// ══════════════════════════════════════════════════════════

async function insertNews(
  supabase: ReturnType<typeof createClient>,
  article: ScrapedArticle,
  related: ScrapedArticle[],
  gemini: GeminiResult,
  bias: { left: number; center: number; right: number; label: string }
): Promise<number | null> {
  const veracityMap: Record<string, string> = {
    real: "verificada",
    misleading: "parcialmente_falsa",
    fake: "fake",
    unverified: "verificada",
  };

  const { data, error } = await supabase.from("news").insert({
    news_type: "feed",
    title: article.title,
    description: article.description,
    category: article.category,
    country: article.country,
    country_code: article.country_code,
    image: article.image,
    source_label: article.source_name,
    credibility: article.source_credibility >= 80 ? "alta" : article.source_credibility >= 50 ? "media" : "baja",
    time_label: formatTimeAgo(article.published_at),
    bias_left: bias.left,
    bias_center: bias.center,
    bias_right: bias.right,
    bias_label: bias.label,
    source_count: related.length + 1,
    veracity: veracityMap[gemini.verdict] || "verificada",
    veracity_detail: gemini.reasoning,
    score_factual: gemini.verdict === "fake" ? Math.min(25, Math.round(gemini.confidence * 0.2))
      : gemini.verdict === "misleading" ? Math.min(45, Math.round(gemini.confidence * 0.5))
      : Math.max(60, Math.round(gemini.confidence * 0.95)),
    score_source_div: Math.min(100, Math.max(40, (related.length + 1) * 20)),
    score_transparency: gemini.verdict === "fake" ? Math.min(30, article.source_credibility)
      : gemini.verdict === "misleading" ? Math.min(50, article.source_credibility)
      : article.source_credibility,
    score_independence: Math.round((100 - Math.abs(bias.left - bias.right)) * 0.9),
    sponsored_flag: gemini.sponsored ? gemini.sponsored_by : null,
    gemini_validated: gemini.confidence > 0,
    gemini_verdict: gemini.verdict,
    gemini_confidence: gemini.confidence,
    gemini_reasoning: gemini.sponsored
      ? `${gemini.reasoning} | PATROCINADA: ${gemini.sponsored_reasoning}`
      : gemini.reasoning,
    gemini_validated_at: new Date().toISOString(),
    published_at: article.published_at,
  }).select("id").single();

  if (error) {
    console.error("[insert] News error:", error.message);
    return null;
  }

  const newsId = data?.id;
  if (!newsId) return null;

  // Insert article paragraphs
  if (article.paragraphs.length > 0) {
    const paragraphInserts = article.paragraphs.map((content, i) => ({
      news_id: newsId,
      content,
      sort_order: i,
    }));
    const { error: pErr } = await supabase.from("article_paragraphs").insert(paragraphInserts);
    if (pErr) console.error("[insert] Paragraphs error:", pErr.message);
  }

  // Insert sources
  const sourcesInsert = [
    {
      news_id: newsId,
      name: article.source_name,
      bias: article.source_bias,
      credibility: article.source_credibility,
      stance: "Fuente original del artículo",
      sort_order: 0,
    },
    ...related.slice(0, 5).map((r, i) => ({
      news_id: newsId,
      name: r.source_name,
      bias: r.source_bias,
      credibility: r.source_credibility,
      stance: `Cobertura relacionada: "${r.title.substring(0, 100)}"`,
      sort_order: i + 1,
    })),
  ];
  const { error: sErr } = await supabase.from("news_sources").insert(sourcesInsert);
  if (sErr) console.error("[insert] Sources error:", sErr.message);

  return newsId;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Hace unos minutos";
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

// ══════════════════════════════════════════════════════════
// MAIN PIPELINE
// ══════════════════════════════════════════════════════════

serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. SCRAPE all feeds (RSS)
    console.log("[pipeline] Step 1: Scraping RSS feeds...");
    const allFeeds = [
      ...RSS_FEEDS.VE.map((f) => ({ feed: f, key: "VE" })),
      ...RSS_FEEDS.CO.map((f) => ({ feed: f, key: "CO" })),
      ...RSS_FEEDS.TECH.map((f) => ({ feed: f, key: "TECH" })),
    ];

    const scrapeResults = await Promise.allSettled(
      allFeeds.map(({ feed, key }) => scrapeFeed(feed, key))
    );

    const allArticles: ScrapedArticle[] = [];
    scrapeResults.forEach((r) => {
      if (r.status === "fulfilled") allArticles.push(...r.value);
    });
    console.log(`[pipeline] Scraped ${allArticles.length} articles from ${allFeeds.length} feeds`);

    // 2. DEDUPLICATE against existing DB
    console.log("[pipeline] Step 2: Deduplicating...");
    const existingTitles = await getExistingTitles(supabase);
    const newArticles = allArticles.filter(
      (a) => !existingTitles.has(a.title.toLowerCase().trim().substring(0, 80))
    );
    console.log(`[pipeline] ${newArticles.length} new articles after dedup`);

    if (newArticles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No new articles found",
          stats: { scraped: allArticles.length, duplicates: allArticles.length, inserted: 0 },
          duration_ms: Date.now() - startTime,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. FETCH FULL CONTENT for articles that don't have it from RSS
    console.log("[pipeline] Step 3: Fetching full article content...");
    // Select up to 10 new articles per country
    const veArticles = newArticles.filter((a) => a.country_code === "VE").slice(0, 10);
    const coArticles = newArticles.filter((a) => a.country_code === "CO").slice(0, 10);
    const techArticles = newArticles.filter((a) => a.country_code === "TECH").slice(0, 10);
    const articlesToProcess = [...veArticles, ...coArticles, ...techArticles];

    // Parallel content fetching (all at once, each has its own 10s timeout)
    await Promise.allSettled(
      articlesToProcess.map(async (article) => {
        if (article.paragraphs.length < 2 || !article.image) {
          const result = await fetchArticleContent(article.url);
          if (result.paragraphs.length > 0 && article.paragraphs.length < 2) {
            article.paragraphs = result.paragraphs;
          } else if (article.paragraphs.length < 2 && article.description.length > 50) {
            article.paragraphs = [article.description];
          }
          // Fill missing image from og:image / twitter:image
          if (!article.image && result.image) {
            article.image = result.image;
            console.log(`[pipeline] ${article.source_name}: filled missing image from page`);
          }
          console.log(`[pipeline] ${article.source_name}: "${article.title.substring(0, 40)}..." → ${article.paragraphs.length} paragraphs${article.image ? ' (img ✓)' : ' (no img)'}`);
        }
      })
    );

    // 4. VALIDATE + INSERT
    console.log("[pipeline] Step 4: Validating and inserting...");
    let inserted = 0;
    let validated = 0;
    let rejected = 0;
    let contentFetched = 0;

    for (const article of articlesToProcess) {
      const related = findRelatedArticles(article, allArticles);
      const internal = validateInternally(article, related);

      // ALWAYS validate with Gemini
      const gemini = await validateWithGemini(article, internal, related);
      validated++;

      // Small delay between Gemini calls to avoid rate limiting
      await delay(300);

      // Log fake/misleading news but still insert them for transparency
      if (gemini.verdict === "fake" || gemini.verdict === "misleading") {
        console.log(`[pipeline] FLAGGED ${gemini.verdict.toUpperCase()}: "${article.title.substring(0, 50)}" — ${gemini.reasoning}`);
      }

      const bias = estimateBias(article, related);
      const id = await insertNews(supabase, article, related, gemini, bias);
      if (id) {
        inserted++;
        if (article.paragraphs.length > 0) contentFetched++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[pipeline] Done in ${duration}ms. Inserted: ${inserted}, Gemini validated: ${validated}, With content: ${contentFetched}, Rejected: ${rejected}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          scraped: allArticles.length,
          new_articles: newArticles.length,
          gemini_validated: validated,
          inserted,
          with_full_content: contentFetched,
          rejected,
        },
        duration_ms: duration,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pipeline] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
