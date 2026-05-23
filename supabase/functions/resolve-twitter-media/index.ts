// supabase/functions/resolve-twitter-media/index.ts
// Resuelve pic.twitter.com/SLUG → tweet ID → media (foto/video) usando
// el endpoint público de syndication de X. Cachea en twitter_cache.
//
// GET ?slug=PpEwghap8r
//     ?id=1234567890&user=usembassyve     (si ya tienes el tweet ID)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type MediaItem = {
  type: "photo" | "video" | "gif";
  url: string;
  poster?: string;
  width?: number;
  height?: number;
};

type ResolveResult = {
  ok: boolean;
  tweet_id?: string;
  user?: string;
  text?: string;
  media: MediaItem[];
  error?: string;
};

async function resolveSlug(slug: string): Promise<{ id: string; user: string } | null> {
  // Intento 1: HEAD con redirect manual (intercepta el location)
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const resp = await fetch(`https://pic.twitter.com/${slug}`, {
        method,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          "Accept": method === "GET" ? "text/html,*/*" : "*/*",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(6000),
      });
      const loc = resp.headers.get("location");
      if (loc) {
        const m = loc.match(/twitter\.com\/([^/]+)\/status\/(\d+)/i);
        if (m) return { user: m[1], id: m[2] };
      }
      // Algunos navegadores entregan respuesta final tras seguir redirect aunque pidas manual
      if (resp.url) {
        const m = resp.url.match(/twitter\.com\/([^/]+)\/status\/(\d+)/i);
        if (m) return { user: m[1], id: m[2] };
      }
    } catch { /* siguiente intento */ }
  }
  // Intento final: follow automatic + leer URL final
  try {
    const resp = await fetch(`https://pic.twitter.com/${slug}`, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    const m = resp.url.match(/twitter\.com\/([^/]+)\/status\/(\d+)/i)
      || resp.url.match(/x\.com\/([^/]+)\/status\/(\d+)/i);
    if (m) return { user: m[1], id: m[2] };
  } catch { /* fail */ }
  return null;
}

async function fetchTweetMedia(id: string): Promise<ResolveResult> {
  try {
    const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=es&token=4`;
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      return { ok: false, media: [], error: `syndication HTTP ${resp.status}` };
    }
    const data = await resp.json();

    const media: MediaItem[] = [];
    for (const m of data.mediaDetails || []) {
      if (m.type === "photo") {
        media.push({
          type: "photo",
          url: m.media_url_https,
          width: m.sizes?.large?.w,
          height: m.sizes?.large?.h,
        });
      } else if (m.type === "video" || m.type === "animated_gif") {
        // Elegir mejor variante MP4 (bitrate más alto en height razonable)
        const variants = (m.video_info?.variants || [])
          .filter((v: any) => v.content_type === "video/mp4")
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = variants[0];
        if (best) {
          media.push({
            type: m.type === "animated_gif" ? "gif" : "video",
            url: best.url,
            poster: m.media_url_https,
          });
        }
      }
    }

    return {
      ok: true,
      tweet_id: id,
      user: data.user?.screen_name,
      text: data.text || "",
      media,
    };
  } catch (e) {
    return { ok: false, media: [], error: String(e).slice(0, 200) };
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.replace(/[^A-Za-z0-9]/g, "");
  let id = url.searchParams.get("id")?.replace(/[^0-9]/g, "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!slug && !id) {
    return new Response(JSON.stringify({ ok: false, error: "slug or id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheKey = `tw_media_v2:${slug || id}`;

  // Check cache (TTL 7 días)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: cached } = await supabase
    .from("twitter_cache")
    .select("data, created_at")
    .eq("cache_key", cacheKey)
    .gte("created_at", sevenDaysAgo)
    .maybeSingle();

  if (cached?.data) {
    return new Response(JSON.stringify({ cached: true, ...cached.data }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  }

  // Resolver slug → ID si hace falta
  if (slug && !id) {
    const r = await resolveSlug(slug);
    if (!r) {
      const out = { ok: false, media: [], error: "slug not resolvable" };
      // cache negativo corto (1h) — guardar string para no permitir nulls
      await supabase.from("twitter_cache").upsert({ cache_key: cacheKey, query: slug, data: out, created_at: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString() });
      return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
    }
    id = r.id;
  }

  const result = await fetchTweetMedia(id!);

  // Guardar en cache (positivo o negativo)
  try {
    await supabase.from("twitter_cache").upsert({
      cache_key: cacheKey,
      query: slug || id || "",
      data: result,
      created_at: new Date().toISOString(),
    });
  } catch { /* silent */ }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
  });
});
