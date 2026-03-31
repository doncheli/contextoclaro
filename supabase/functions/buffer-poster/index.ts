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
  const resp = await fetch("https://api.bufferapp.com/1/profiles.json", {
    headers: { Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}` },
  });
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
    const body: any = {
      profile_ids: profileIds,
      text,
      media: { link, thumbnail: imageUrl, photo: imageUrl },
      shorten: true,
    };

    const resp = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "profile_ids[]": profileIds.join(","),
        text,
        "media[link]": link,
        "media[photo]": imageUrl,
        "media[thumbnail]": imageUrl,
        shorten: "true",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[buffer] Post error: ${err}`);
      return { success: false, error: err.substring(0, 300) };
    }

    const data = await resp.json();
    return { success: data.success || false, updates: data.updates };
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

    // 2. Get the latest verified news (different from what X posted — offset by 1)
    const { data: news, error } = await supabase
      .from("news")
      .select("*")
      .not("gemini_verdict", "is", null)
      .not("image", "is", null)
      .in("country_code", ["VE", "CO", "TECH"])
      .order("published_at", { ascending: false })
      .limit(3);

    if (error || !news?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "No news found", detail: error?.message }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Pick the best news: prefer fake/misleading (more engagement), then most sources
    const sorted = [...news].sort((a, b) => {
      const priority: Record<string, number> = { fake: 3, misleading: 2, real: 1, unverified: 0 };
      const aPri = priority[a.gemini_verdict] || 0;
      const bPri = priority[b.gemini_verdict] || 0;
      if (aPri !== bPri) return bPri - aPri;
      return (b.source_count || 0) - (a.source_count || 0);
    });

    const selected = sorted[0];
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
