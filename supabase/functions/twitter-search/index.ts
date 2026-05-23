// supabase/functions/twitter-search/index.ts
// Búsqueda en X / Twitter API v2 usando Bearer Token (app-only).
// Devuelve tweets recientes + imágenes y videos asociados.
//
// Query params:
//   ?q=<query>       — texto a buscar (max 512 chars)
//   ?max=10          — máximo de tweets (10-100)
//   ?lang=es         — idioma (opcional)
//
// Notas: Free tier de X tiene cuota ~1500 tweets/mes. Cachéamos en
// la tabla `twitter_cache` para evitar consumir cuota innecesariamente.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// El bearer viene URL-encoded del developer portal — lo decodificamos
const BEARER_RAW = Deno.env.get("TWITTER_BEARER_TOKEN") || "";
const BEARER = decodeURIComponent(BEARER_RAW);

const CACHE_TTL_MIN = 60; // 1h por query

serve(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const max = Math.min(100, Math.max(10, parseInt(url.searchParams.get("max") || "10", 10)));
  const lang = (url.searchParams.get("lang") || "").trim();

  if (!q) {
    return new Response(JSON.stringify({ ok: false, error: "Falta param ?q=" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!BEARER) {
    return new Response(JSON.stringify({ ok: false, error: "TWITTER_BEARER_TOKEN no configurado" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Buscar en cache
  const cacheKey = `${q}__${max}__${lang}`;
  const { data: cached } = await supabase
    .from("twitter_cache")
    .select("data, created_at")
    .eq("cache_key", cacheKey)
    .gte("created_at", new Date(Date.now() - CACHE_TTL_MIN * 60_000).toISOString())
    .maybeSingle();

  if (cached?.data) {
    return new Response(JSON.stringify({ ok: true, cached: true, ...cached.data }), { headers: { "Content-Type": "application/json" } });
  }

  // Construir query X v2
  let query = q;
  if (lang) query += ` lang:${lang}`;
  query += " -is:retweet has:media"; // solo tweets con media, no RT
  if (query.length > 512) query = query.slice(0, 512);

  const params = new URLSearchParams({
    query,
    max_results: String(max),
    "tweet.fields": "created_at,author_id,public_metrics,lang",
    "expansions": "attachments.media_keys,author_id",
    "media.fields": "type,url,preview_image_url,variants,width,height,alt_text",
    "user.fields": "name,username,profile_image_url,verified",
  });

  const apiUrl = `https://api.x.com/2/tweets/search/recent?${params.toString()}`;
  let apiResp: Response;
  try {
    apiResp = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${BEARER}` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: `Network error: ${e}` }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  if (!apiResp.ok) {
    const text = await apiResp.text().catch(() => "");
    return new Response(JSON.stringify({ ok: false, status: apiResp.status, error: text.slice(0, 500) }), { status: apiResp.status, headers: { "Content-Type": "application/json" } });
  }

  const raw = await apiResp.json();

  // Procesar: vincular tweets con media y autores
  const mediaByKey: Record<string, any> = {};
  for (const m of raw.includes?.media || []) mediaByKey[m.media_key] = m;
  const usersById: Record<string, any> = {};
  for (const u of raw.includes?.users || []) usersById[u.id] = u;

  const items = (raw.data || []).map((t: any) => {
    const author = usersById[t.author_id] || {};
    const mediaKeys: string[] = t.attachments?.media_keys || [];
    const media = mediaKeys.map((k) => {
      const m = mediaByKey[k];
      if (!m) return null;
      if (m.type === "photo") return { type: "photo", url: m.url, alt: m.alt_text };
      if (m.type === "video" || m.type === "animated_gif") {
        // Variants — pick best MP4
        const mp4s = (m.variants || []).filter((v: any) => v.content_type === "video/mp4").sort((a: any, b: any) => (b.bit_rate || 0) - (a.bit_rate || 0));
        return {
          type: m.type,
          poster: m.preview_image_url,
          url: mp4s[0]?.url || null,
          bitrate: mp4s[0]?.bit_rate,
        };
      }
      return null;
    }).filter(Boolean);

    return {
      id: t.id,
      text: t.text,
      lang: t.lang,
      created_at: t.created_at,
      metrics: t.public_metrics,
      author: { id: t.author_id, username: author.username, name: author.name, avatar: author.profile_image_url, verified: author.verified },
      media,
      url: `https://x.com/${author.username || "i"}/status/${t.id}`,
    };
  });

  const result = {
    query,
    count: items.length,
    items,
  };

  // Cachear (best-effort)
  try {
    await supabase.from("twitter_cache").upsert({ cache_key: cacheKey, query: q, data: result, created_at: new Date().toISOString() });
  } catch { /* silent */ }

  return new Response(JSON.stringify({ ok: true, cached: false, ...result }), { headers: { "Content-Type": "application/json" } });
});
