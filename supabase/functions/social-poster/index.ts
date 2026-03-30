// supabase/functions/social-poster/index.ts
// Edge Function: Auto-post top news to X (Twitter) every hour
// Generates social card text with verification, score, and bias data

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// X (Twitter) API credentials
const X_API_KEY = Deno.env.get("X_API_KEY") || "";
const X_API_SECRET = Deno.env.get("X_API_SECRET") || "";
const X_ACCESS_TOKEN = Deno.env.get("X_ACCESS_TOKEN") || "";
const X_ACCESS_TOKEN_SECRET = Deno.env.get("X_ACCESS_TOKEN_SECRET") || "";

// ══════════════════════════════════════════════════════════
// OAUTH 1.0a SIGNATURE FOR X API
// ══════════════════════════════════════════════════════════

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function signRequest(method: string, url: string, params: Record<string, string>): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: "1.0",
    ...params,
  };

  // Sort and encode parameters
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join("&");

  // Create signature base string
  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(X_API_SECRET)}&${percentEncode(X_ACCESS_TOKEN_SECRET)}`;

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // Build Authorization header
  const authParams = [
    `oauth_consumer_key="${percentEncode(X_API_KEY)}"`,
    `oauth_nonce="${percentEncode(nonce)}"`,
    `oauth_signature="${percentEncode(sig)}"`,
    `oauth_signature_method="HMAC-SHA1"`,
    `oauth_timestamp="${timestamp}"`,
    `oauth_token="${percentEncode(X_ACCESS_TOKEN)}"`,
    `oauth_version="1.0"`,
  ];

  return `OAuth ${authParams.join(", ")}`;
}

// ══════════════════════════════════════════════════════════
// POST TO X (TWITTER) API v2
// ══════════════════════════════════════════════════════════

async function postToX(text: string): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    return { success: false, error: "X API credentials not configured" };
  }

  const url = "https://api.twitter.com/2/tweets";
  const body = JSON.stringify({ text });

  const authHeader = await signRequest("POST", url, {});

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[x-api] HTTP ${resp.status}: ${err}`);
      return { success: false, error: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
    }

    const data = await resp.json();
    return { success: true, id: data.data?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ══════════════════════════════════════════════════════════
// GENERATE SOCIAL POST TEXT
// ══════════════════════════════════════════════════════════

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function generatePostText(news: any): string {
  const verdictEmoji: Record<string, string> = {
    real: "✅",
    misleading: "⚠️",
    fake: "🚨",
    unverified: "❓",
  };
  const verdictLabel: Record<string, string> = {
    real: "REAL",
    misleading: "ENGAÑOSA",
    fake: "FALSA",
    unverified: "SIN VERIFICAR",
  };

  const emoji = verdictEmoji[news.gemini_verdict] || "❓";
  const label = verdictLabel[news.gemini_verdict] || "SIN VERIFICAR";
  const score = Math.round(
    (news.score_factual * 0.35 + news.score_source_div * 0.25 + news.score_transparency * 0.25 + news.score_independence * 0.15)
  );

  // Bias description
  const biasDesc =
    news.bias_left > 60 ? "Sesgo: Izquierda" :
    news.bias_right > 60 ? "Sesgo: Derecha" :
    Math.abs(news.bias_left - news.bias_right) <= 20 ? "Sesgo: Equilibrado" : "Sesgo: Centro";

  const slug = slugify(news.title);
  const url = `https://contextoclaro.com/noticia/${slug}-${news.id}`;

  const lines = [
    `${emoji} ${label} (${news.gemini_confidence}% confianza)`,
    ``,
    `${news.title}`,
    ``,
    `📊 Score: ${score}/100 | ${biasDesc}`,
    `📰 ${news.source_count || 1} fuentes | ${news.country} ${news.source_label}`,
    ``,
    `🔗 ${url}`,
    ``,
    `#ContextoClaro #FakeNews #Venezuela #Colombia #NoticiasFalsas`,
  ];

  // Twitter limit: 280 chars. Trim if needed.
  let text = lines.join("\n");
  if (text.length > 280) {
    // Shorten title
    const maxTitle = 280 - (text.length - news.title.length) - 3;
    const shortTitle = news.title.substring(0, maxTitle) + "...";
    lines[2] = shortTitle;
    text = lines.join("\n");
  }

  return text;
}

// ══════════════════════════════════════════════════════════
// TRACKING TABLE (avoid duplicate posts)
// ══════════════════════════════════════════════════════════

async function getLastPostedId(supabase: any): Promise<number | null> {
  // Use a simple approach: check if we posted this news in the last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("news")
    .select("id")
    .not("gemini_verdict", "is", null)
    .gte("published_at", twoHoursAgo)
    .in("country_code", ["VE", "CO", "TECH"])
    .order("published_at", { ascending: false })
    .limit(1)
    .single();

  return data?.id || null;
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the latest verified news that hasn't been posted
    const { data: news, error } = await supabase
      .from("news")
      .select("*")
      .not("gemini_verdict", "is", null)
      .in("country_code", ["VE", "CO", "TECH"])
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !news) {
      return new Response(
        JSON.stringify({ success: false, message: "No news found", duration_ms: Date.now() - startTime }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate post text
    const postText = generatePostText(news);
    console.log(`[social-poster] Posting news ${news.id}: ${news.title.substring(0, 50)}...`);

    // Post to X
    const xResult = await postToX(postText);

    const result = {
      success: true,
      news_id: news.id,
      news_title: news.title,
      verdict: news.gemini_verdict,
      post_text: postText,
      x: xResult,
      card_url: `https://contextoclaro.com/social-card?id=${news.id}`,
      duration_ms: Date.now() - startTime,
    };

    console.log(`[social-poster] Result:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[social-poster] Error: ${e}`);
    return new Response(
      JSON.stringify({ success: false, error: String(e), duration_ms: Date.now() - startTime }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});
