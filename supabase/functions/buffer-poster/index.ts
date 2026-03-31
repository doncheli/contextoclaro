// supabase/functions/buffer-poster/index.ts
// Edge Function: Auto-post top news to Instagram/TikTok via Buffer
// Runs 3x daily at peak hours VE/CO (same schedule as X poster)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUFFER_ACCESS_TOKEN = Deno.env.get("BUFFER_ACCESS_TOKEN") || "";

// ══════════════════════════════════════════════════════════
// BUFFER API
// ══════════════════════════════════════════════════════════

interface BufferProfile {
  id: string;
  service: string;
  formatted_username: string;
}

async function getBufferProfiles(): Promise<BufferProfile[]> {
  const resp = await fetch(`https://api.bufferapp.com/1/profiles.json?access_token=${BUFFER_ACCESS_TOKEN}`);
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[buffer] Profiles error: ${err}`);
    return [];
  }
  return resp.json();
}

async function postToBuffer(
  profileIds: string[],
  text: string,
  link: string,
  imageUrl: string
): Promise<{ success: boolean; updates?: any; error?: string }> {
  try {
    // Buffer API needs access_token as param + each profile_id separate
    const params = new URLSearchParams();
    params.append("access_token", BUFFER_ACCESS_TOKEN);
    profileIds.forEach((id) => params.append("profile_ids[]", id));
    params.append("text", text);
    params.append("media[link]", link);
    params.append("media[photo]", imageUrl);
    params.append("media[thumbnail]", imageUrl);
    params.append("shorten", "true");

    const resp = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const raw = await resp.text();
    console.log(`[buffer] Response ${resp.status}: ${raw.substring(0, 500)}`);

    try {
      const data = JSON.parse(raw);
      return { success: data.success || false, status: resp.status, updates: data.updates, message: data.message, raw: raw.substring(0, 300) };
    } catch {
      return { success: false, status: resp.status, error: `Non-JSON: ${raw.substring(0, 200)}` };
    }
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function computeScore(n: any): number {
  return Math.round(
    (n.score_factual || 0) * 0.35 +
    (n.score_source_div || 0) * 0.25 +
    (n.score_transparency || 0) * 0.25 +
    (n.score_independence || 0) * 0.15
  );
}

function generateCaption(news: any): string {
  const verdictEmoji: Record<string, string> = {
    real: "✅", misleading: "⚠️", fake: "🚨", unverified: "❓",
  };
  const verdictLabel: Record<string, string> = {
    real: "REAL", misleading: "ENGAÑOSA", fake: "FALSA", unverified: "SIN VERIFICAR",
  };

  const emoji = verdictEmoji[news.gemini_verdict] || "❓";
  const label = verdictLabel[news.gemini_verdict] || "SIN VERIFICAR";
  const score = computeScore(news);
  const biasDesc =
    news.bias_left > 60 ? "⬅️ Izquierda" :
    news.bias_right > 60 ? "➡️ Derecha" :
    "⚖️ Equilibrado";

  const reasoning = news.gemini_reasoning
    ? news.gemini_reasoning.split("|")[0].trim().substring(0, 150)
    : "";

  const url = `https://contextoclaro.com/noticia/${slugify(news.title)}-${news.id}`;

  return [
    `${emoji} ${label} (${news.gemini_confidence}% confianza)`,
    ``,
    `📰 ${news.title}`,
    ``,
    reasoning ? `💬 ${reasoning}` : "",
    ``,
    `📊 Score: ${score}/100`,
    `${biasDesc} | ${news.source_count || 1} fuentes`,
    `🗞️ ${news.source_label} ${news.country}`,
    ``,
    `🔗 Análisis completo en contextoclaro.com`,
    `(link en bio)`,
    ``,
    `—`,
    `Filtramos el ruido. Entregamos la verdad.`,
    ``,
    `#ContextoClaro #FakeNews #NoticiasFalsas #Venezuela #Colombia #IA #Verificación #Noticias #DesinformaciónLATAM #DonCheli`,
    ``,
    `📅 ${new Date().toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join("\n");
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    if (!BUFFER_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "BUFFER_ACCESS_TOKEN not set" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get Buffer profiles (Instagram, TikTok, etc.)
    const profiles = await getBufferProfiles();
    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No Buffer profiles found. Connect Instagram/TikTok in Buffer first." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const profileIds = profiles.map((p) => p.id);
    const profileNames = profiles.map((p) => `${p.service}: ${p.formatted_username}`);
    console.log(`[buffer] Found ${profiles.length} profiles: ${profileNames.join(", ")}`);

    // 2. Get recent verified news with images
    const { data: news, error } = await supabase
      .from("news")
      .select("*")
      .not("gemini_verdict", "is", null)
      .not("image", "is", null)
      .in("country_code", ["VE", "CO", "TECH"])
      .order("published_at", { ascending: false })
      .limit(10);

    if (error || !news?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "No news found", detail: error?.message }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Use hour of day as offset so each post is a different story
    // 8AM=0, 1PM=1, 8PM=2 — maps to different news picks
    const hour = new Date().getUTCHours();
    const slot = hour <= 12 ? 0 : hour <= 17 ? 1 : 2;

    // Each of the 3 daily posts picks a different news by time slot
    // Slot 0 (8AM): most impactful (fake/misleading first)
    // Slot 1 (1PM): most covered (highest source count)
    // Slot 2 (8PM): latest verified real news
    let selected;
    if (slot === 0) {
      // Morning: prioritize fake/misleading for engagement
      const fakes = news.filter((n: any) => n.gemini_verdict === "fake" || n.gemini_verdict === "misleading");
      selected = fakes.length > 0 ? fakes[0] : news[0];
    } else if (slot === 1) {
      // Afternoon: most covered story
      const byCoverage = [...news].sort((a: any, b: any) => (b.source_count || 0) - (a.source_count || 0));
      // Skip the one used in morning slot
      selected = byCoverage.find((n: any) => n.id !== news[0]?.id) || byCoverage[0];
    } else {
      // Night: latest news not used in previous slots
      selected = news.length >= 3 ? news[2] : news[news.length - 1];
    }
    const caption = generateCaption(selected);
    const cardUrl = `https://contextoclaro.com/social-card?id=${selected.id}&style=0`;
    const imageUrl = selected.image;

    console.log(`[buffer] Posting news ${selected.id}: ${selected.title.substring(0, 50)}...`);

    // 3. Post to all Buffer profiles
    const result = await postToBuffer(profileIds, caption, cardUrl, imageUrl);

    return new Response(
      JSON.stringify({
        success: result.success,
        news_id: selected.id,
        news_title: selected.title,
        verdict: selected.gemini_verdict,
        profiles: profileNames,
        caption_length: caption.length,
        card_url: cardUrl,
        buffer_result: result,
        duration_ms: Date.now() - startTime,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[buffer] Error: ${e}`);
    return new Response(
      JSON.stringify({ success: false, error: String(e), duration_ms: Date.now() - startTime }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});
