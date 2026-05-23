// supabase/functions/refresh-political-feed/index.ts
// Trae posts de Mastodon (#Venezuela, #Colombia, #Petro, #Maduro) y
// Google News RSS (política VE/CO) y los upserta en political_tweets
// para que el carousel funcione sin depender de X (que bloqueó free tier).
//
// Tabla destino: political_tweets (extendida en migration 20260524001200).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type FeedItem = {
  source: "mastodon" | "gnews";
  source_name: string;
  tweet_id: string;
  text: string;
  title: string | null;
  url: string;
  created_at: string;
  country_code: "VE" | "CO";
  author_name: string | null;
  author_handle: string | null;
  media: { type: "photo"; url: string }[] | null;
};

const MASTODON_TAGS: Array<{ tag: string; country: "VE" | "CO" }> = [
  { tag: "Venezuela", country: "VE" },
  { tag: "Maduro", country: "VE" },
  { tag: "Caracas", country: "VE" },
  { tag: "Colombia", country: "CO" },
  { tag: "Petro", country: "CO" },
  { tag: "Bogota", country: "CO" },
];

const GNEWS_QUERIES: Array<{ q: string; gl: string; country: "VE" | "CO" }> = [
  { q: "política venezuela", gl: "VE", country: "VE" },
  { q: "maduro", gl: "VE", country: "VE" },
  { q: "asamblea nacional venezuela", gl: "VE", country: "VE" },
  { q: "política colombia", gl: "CO", country: "CO" },
  { q: "petro presidente", gl: "CO", country: "CO" },
  { q: "congreso colombia", gl: "CO", country: "CO" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function stripHtml(s: string): string {
  // 2 pasadas: decode entities → strip tags → decode otra vez por si quedan
  let out = decodeEntities(s);
  out = out.replace(/<[^>]+>/g, " ");
  out = decodeEntities(out);
  return out.replace(/\s+/g, " ").trim();
}

function extractTag(xml: string, tag: string): string | null {
  // Match <tag>...</tag> o <tag ...>...</tag>, primer match
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  let val = m[1].trim();
  // CDATA
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) val = cdata[1];
  return val;
}

function splitItems(xml: string, itemTag: string): string[] {
  const re = new RegExp(`<${itemTag}[^>]*>[\\s\\S]*?<\\/${itemTag}>`, "gi");
  return xml.match(re) || [];
}

async function fetchMastodonFeed(tag: string, country: "VE" | "CO"): Promise<FeedItem[]> {
  const url = `https://mastodon.social/tags/${encodeURIComponent(tag)}.rss`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "ContextoClaro/1.0 (+https://contextoclaro.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items = splitItems(xml, "item");
    return items.slice(0, 15).map((it) => {
      const link = extractTag(it, "link") || "";
      const guid = extractTag(it, "guid") || link;
      const title = stripHtml(extractTag(it, "title") || "");
      const desc = stripHtml(extractTag(it, "description") || "");
      const pubDate = extractTag(it, "pubDate") || new Date().toISOString();
      const author = extractTag(it, "dc:creator") || null;
      // Mastodon mete imágenes como <media:content url="...">
      const mediaMatch = it.match(/<media:content[^>]+url="([^"]+)"/);
      return {
        source: "mastodon",
        source_name: `Mastodon #${tag}`,
        tweet_id: guid,
        text: desc.slice(0, 500),
        title: title.slice(0, 200) || null,
        url: link,
        created_at: new Date(pubDate).toISOString(),
        country_code: country,
        author_name: author,
        author_handle: author,
        media: mediaMatch ? [{ type: "photo", url: mediaMatch[1] }] : null,
      } as FeedItem;
    });
  } catch (e) {
    console.warn(`[mastodon ${tag}] error:`, e);
    return [];
  }
}

async function fetchGNewsFeed(q: string, gl: string, country: "VE" | "CO"): Promise<FeedItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=${gl}&ceid=${gl}:es`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "ContextoClaro/1.0 (+https://contextoclaro.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items = splitItems(xml, "item");
    return items.slice(0, 10).map((it) => {
      const link = extractTag(it, "link") || "";
      const guid = extractTag(it, "guid") || link;
      const title = stripHtml(extractTag(it, "title") || "");
      const pubDate = extractTag(it, "pubDate") || new Date().toISOString();
      const source = extractTag(it, "source") || "Google News";
      return {
        source: "gnews",
        source_name: source,
        tweet_id: guid,
        text: title.slice(0, 500),
        title: title.slice(0, 200) || null,
        url: link,
        created_at: new Date(pubDate).toISOString(),
        country_code: country,
        author_name: source,
        author_handle: null,
        media: null,
      } as FeedItem;
    });
  } catch (e) {
    console.warn(`[gnews ${q}] error:`, e);
    return [];
  }
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Paralelizar todos los fetches
  const mastodonTasks = MASTODON_TAGS.map((t) => fetchMastodonFeed(t.tag, t.country));
  const gnewsTasks = GNEWS_QUERIES.map((q) => fetchGNewsFeed(q.q, q.gl, q.country));

  const results = await Promise.allSettled([...mastodonTasks, ...gnewsTasks]);
  const allItems: FeedItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  if (allItems.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "No items from any feed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Deduplicar por tweet_id+source+country dentro del batch
  const seen = new Set<string>();
  const dedup = allItems.filter((i) => {
    const k = `${i.tweet_id}__${i.source}__${i.country_code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Upsert en política_tweets (constraint compuesto manejará idempotencia)
  const rows = dedup.map((i) => ({
    tweet_id: i.tweet_id,
    text: i.text,
    title: i.title,
    url: i.url,
    source: i.source,
    source_name: i.source_name,
    country_code: i.country_code,
    author_name: i.author_name,
    author_handle: i.author_handle,
    media: i.media,
    tweet_created_at: i.created_at,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("political_tweets")
    .upsert(rows, { onConflict: "tweet_id,source,country_code", ignoreDuplicates: false });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message, count: rows.length }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Limpiar items viejos (>48h) para mantener tabla liviana
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  await supabase.from("political_tweets").delete().lt("fetched_at", cutoff);

  return new Response(
    JSON.stringify({
      ok: true,
      inserted: rows.length,
      sources: {
        mastodon: rows.filter((r) => r.source === "mastodon").length,
        gnews: rows.filter((r) => r.source === "gnews").length,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
