// supabase/functions/scrape-news/index.ts
// Edge Function: Scrape RSS feeds from Venezuelan and Colombian news sources
// Returns structured news articles ready for validation

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ══════════════════════════════════════════════════════════
// RSS FEED SOURCES
// ══════════════════════════════════════════════════════════

const RSS_FEEDS = {
  VE: [
    { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/", bias: "centro", credibility: 88 },
    { name: "El Nacional", url: "https://www.elnacional.com/feed/", bias: "centro-derecha", credibility: 80 },
    { name: "La Patilla", url: "https://www.lapatilla.com/feed/", bias: "centro-derecha", credibility: 75 },
    { name: "Correo del Caroní", url: "https://correodelcaroni.com/feed/", bias: "centro", credibility: 85 },
    { name: "El Diario", url: "https://eldiario.com/feed/", bias: "centro-izquierda", credibility: 80 },
    { name: "Runrunes", url: "https://runrun.es/feed/", bias: "centro", credibility: 82 },
  ],
  CO: [
    { name: "El Tiempo", url: "https://www.eltiempo.com/rss/titulares.xml", bias: "centro", credibility: 88 },
    { name: "Infobae Colombia", url: "https://www.infobae.com/feeds/rss/colombia/", bias: "centro-derecha", credibility: 83 },
    { name: "Semana", url: "https://www.semana.com/rss", bias: "centro-derecha", credibility: 82 },
    { name: "El Espectador", url: "https://www.elespectador.com/rss", bias: "centro-izquierda", credibility: 85 },
    { name: "La Silla Vacía", url: "https://www.lasillavacia.com/feed/", bias: "centro", credibility: 92 },
    { name: "Blu Radio", url: "https://www.bluradio.com/rss", bias: "centro", credibility: 82 },
  ],
};

const COUNTRY_META: Record<string, { emoji: string; code: string }> = {
  VE: { emoji: "🇻🇪", code: "VE" },
  CO: { emoji: "🇨🇴", code: "CO" },
};

// ══════════════════════════════════════════════════════════
// RSS PARSER (lightweight, no external deps)
// ══════════════════════════════════════════════════════════

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  image?: string;
  category?: string;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`)
  );
  if (cdataMatch) return cdataMatch[1].trim();

  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : "";
}

function extractImage(itemXml: string): string | undefined {
  // Try media:content
  const mediaMatch = itemXml.match(/url="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
  if (mediaMatch) return mediaMatch[1];

  // Try enclosure
  const enclosureMatch = itemXml.match(/<enclosure[^>]+url="(https?:\/\/[^"]+)"/);
  if (enclosureMatch) return enclosureMatch[1];

  // Try img tag in description
  const imgMatch = itemXml.match(/<img[^>]+src="(https?:\/\/[^"]+)"/);
  if (imgMatch) return imgMatch[1];

  return undefined;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const description = extractTag(itemXml, "description")
      .replace(/<[^>]+>/g, "") // strip HTML
      .substring(0, 500);
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const image = extractImage(itemXml);
    const category = extractTag(itemXml, "category");

    if (title && link) {
      items.push({ title, description, link, pubDate, image, category });
    }
  }

  return items;
}

// ══════════════════════════════════════════════════════════
// FETCH + PARSE FEEDS
// ══════════════════════════════════════════════════════════

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
}

async function scrapeFeed(
  feed: { name: string; url: string; bias: string; credibility: number },
  countryKey: string
): Promise<ScrapedArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "LatamInsight-Bot/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[scrape] ${feed.name}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRss(xml);
    const meta = COUNTRY_META[countryKey];

    return items.slice(0, 10).map((item) => ({
      title: item.title,
      description: item.description,
      url: item.link,
      image: item.image,
      category: `${countryKey === "VE" ? "VENEZUELA" : "COLOMBIA"} · ${item.category || "GENERAL"}`.toUpperCase(),
      country: meta.emoji,
      country_code: meta.code,
      source_name: feed.name,
      source_bias: feed.bias,
      source_credibility: feed.credibility,
      published_at: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`[scrape] ${feed.name} error:`, error);
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// DEDUPLICATION
// ══════════════════════════════════════════════════════════

function deduplicateArticles(articles: ScrapedArticle[]): ScrapedArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    // Normalize title for comparison
    const key = article.title
      .toLowerCase()
      .replace(/[^a-záéíóúñ\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 80);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ══════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════

serve(async (req: Request) => {
  try {
    const { country } = await req.json().catch(() => ({ country: "ALL" }));

    const feedsToScrape: Array<{
      feed: (typeof RSS_FEEDS.VE)[0];
      countryKey: string;
    }> = [];

    if (country === "ALL" || country === "VE") {
      RSS_FEEDS.VE.forEach((feed) =>
        feedsToScrape.push({ feed, countryKey: "VE" })
      );
    }
    if (country === "ALL" || country === "CO") {
      RSS_FEEDS.CO.forEach((feed) =>
        feedsToScrape.push({ feed, countryKey: "CO" })
      );
    }

    // Scrape all feeds in parallel
    const results = await Promise.allSettled(
      feedsToScrape.map(({ feed, countryKey }) =>
        scrapeFeed(feed, countryKey)
      )
    );

    const allArticles: ScrapedArticle[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        allArticles.push(...result.value);
      } else {
        errors.push(
          `${feedsToScrape[i].feed.name}: ${result.reason}`
        );
      }
    });

    // Deduplicate
    const uniqueArticles = deduplicateArticles(allArticles);

    // Sort by date (newest first)
    uniqueArticles.sort(
      (a, b) =>
        new Date(b.published_at).getTime() -
        new Date(a.published_at).getTime()
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: uniqueArticles.length,
        articles: uniqueArticles,
        errors: errors.length > 0 ? errors : undefined,
        scraped_at: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
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
