// supabase/functions/buffer-poster/index.ts
// Auto-post verified news to Buffer every hour
// Instagram: single image post | TikTok: multi-image slideshow (3-6 images)
// Images scraped from article source, resized, uploaded to Supabase Storage

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUFFER_API_KEY = Deno.env.get("BUFFER_ACCESS_TOKEN") || "";
const BUFFER_ORG_ID = Deno.env.get("BUFFER_ORG_ID") || "";
const BUFFER_API = "https://api.buffer.com";
const STORAGE_BUCKET = "social-media";
const RESIZE_PROXY = "https://wsrv.nl";

// ══════════════════════════════════════════════════════════
// BUFFER GRAPHQL
// ══════════════════════════════════════════════════════════

async function bufferGQL(query: string, variables?: Record<string, any>): Promise<any> {
  const body: any = { query };
  if (variables) body.variables = variables;
  const resp = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BUFFER_API_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.errors?.length) console.error(`[buffer] GQL errors:`, JSON.stringify(data.errors).substring(0, 500));
  return data;
}

async function getChannels(): Promise<{ id: string; name: string; service: string }[]> {
  const r = await bufferGQL(`query($o:OrganizationId!){channels(input:{organizationId:$o}){id name service}}`, { o: BUFFER_ORG_ID });
  return r?.data?.channels || [];
}

async function postToChannel(input: any): Promise<{ success: boolean; postId?: string; error?: string }> {
  console.log(`[buffer] Posting to ${input.channelId}, assets: ${JSON.stringify(input.assets || {}).substring(0, 200)}`);
  const r = await bufferGQL(`
    mutation($input:CreatePostInput!){createPost(input:$input){
      ...on PostActionSuccess{post{id status}}
      ...on MutationError{message}
    }}`, { input });
  const post = r?.data?.createPost?.post;
  if (post?.id) return { success: true, postId: post.id };
  return { success: false, error: r?.data?.createPost?.message || r?.errors?.[0]?.message || "Unknown" };
}

// ══════════════════════════════════════════════════════════
// IMAGE SCRAPER — extracts images from article HTML
// ══════════════════════════════════════════════════════════

async function scrapeArticleImages(sourceUrl: string, mainImage: string): Promise<string[]> {
  const images: string[] = [];
  try {
    // Follow redirects to get actual article URL
    const resp = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContextoClaroBot/1.0)" },
    });
    if (!resp.ok) return [mainImage];

    const html = await resp.text();

    // Extract image URLs from <img> tags and <meta og:image>
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const ogRegex = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    const srcsetRegex = /srcset=["']([^"']+)["']/gi;

    // Collect og:image first (highest quality)
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
      const url = match[1].trim();
      if (isValidImageUrl(url) && url !== mainImage) images.push(url);
    }

    // Then img tags
    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1].trim();
      if (isValidImageUrl(url) && url !== mainImage && !images.includes(url)) {
        images.push(url);
      }
    }

    // Also check srcset for high-res versions
    while ((match = srcsetRegex.exec(html)) !== null) {
      const entries = match[1].split(",").map((s: string) => s.trim().split(/\s+/)[0]);
      for (const url of entries) {
        if (isValidImageUrl(url) && url !== mainImage && !images.includes(url)) {
          images.push(url);
        }
      }
    }
  } catch (e) {
    console.warn(`[scraper] Failed to scrape ${sourceUrl}: ${e}`);
  }

  // Filter and deduplicate
  const filtered = images
    .filter((url) => !url.includes("logo") && !url.includes("icon") && !url.includes("avatar")
      && !url.includes("favicon") && !url.includes("banner") && !url.includes("ad-")
      && !url.includes("pixel") && !url.includes("tracking") && !url.includes("1x1")
      && !url.endsWith(".svg") && !url.endsWith(".gif")
      && url.startsWith("http"))
    .slice(0, 5); // Max 5 scraped + 1 main = 6

  // Always include main image first
  return [mainImage, ...filtered].slice(0, 6);
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 20) return false;
  if (url.startsWith("data:")) return false;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const validExts = ["jpg", "jpeg", "png", "webp"];
  const hasExt = validExts.includes(ext);
  const hasImagePath = url.includes("/image") || url.includes("/photo") || url.includes("/upload")
    || url.includes("/wp-content") || url.includes("/media") || url.includes("/img");
  return hasExt || hasImagePath;
}

// ══════════════════════════════════════════════════════════
// IMAGE RESIZE + UPLOAD TO SUPABASE STORAGE
// ══════════════════════════════════════════════════════════

async function resizeAndUpload(
  supabase: any,
  imageUrl: string,
  newsId: number,
  index: number,
): Promise<string | null> {
  try {
    // Download resized image via wsrv.nl proxy
    const resizedUrl = `${RESIZE_PROXY}/?url=${encodeURIComponent(imageUrl)}&w=1080&h=1080&fit=cover&output=jpg&q=80`;
    const resp = await fetch(resizedUrl);
    if (!resp.ok) {
      console.warn(`[resize] Failed for ${imageUrl}: ${resp.status}`);
      return null;
    }

    const blob = await resp.blob();
    if (blob.size < 5000) return null; // Skip tiny images

    const path = `slides/${newsId}/${index}.jpg`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.warn(`[upload] Failed: ${error.message}`);
      return null;
    }

    // Return public URL
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn(`[resize] Error: ${e}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// CAPTION GENERATOR
// ══════════════════════════════════════════════════════════

function slugify(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function computeScore(n: any): number {
  return Math.round(
    (n.score_factual || 0) * 0.35 + (n.score_source_div || 0) * 0.25 +
    (n.score_transparency || 0) * 0.25 + (n.score_independence || 0) * 0.15
  );
}

// ── URL Shortener (TinyURL — free, no key needed) ──

async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const resp = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (resp.ok) {
      const short = await resp.text();
      if (short.startsWith("http")) return short;
    }
  } catch {}
  return longUrl;
}

// ── Caption Generator ──

async function generateCaption(news: any): Promise<string> {
  const verdicts: Record<string, { emoji: string; hook: string }> = {
    real:       { emoji: "✅", hook: "NOTICIA VERIFICADA" },
    misleading: { emoji: "⚠️", hook: "ALERTA: NOTICIA ENGAÑOSA" },
    fake:       { emoji: "🚫", hook: "ALERTA: NOTICIA FALSA" },
    unverified: { emoji: "❓", hook: "NOTICIA SIN VERIFICAR" },
  };

  const v = verdicts[news.gemini_verdict] || verdicts.unverified;
  const score = computeScore(news);
  const l = news.bias_left || 0, c = news.bias_center || 0, r = news.bias_right || 0;
  const sources = news.source_count || 1;

  const sIcon = score >= 85 ? "🟢" : score >= 70 ? "🔵" : score >= 50 ? "🟡" : "🔴";
  const sLabel = score >= 85 ? "Muy fiable" : score >= 70 ? "Fiable" : score >= 50 ? "Precaución" : "No fiable";
  const bLabel = l > 60 ? "⬅️ Izquierda" : r > 60 ? "➡️ Derecha" : c > 60 ? "⚖️ Centro" : "↔️ Mixta";

  const reasoning = news.gemini_reasoning
    ? news.gemini_reasoning.split("|")[0].trim().substring(0, 130)
    : "";

  const longUrl = `https://contextoclaro.com/noticia/${slugify(news.title)}-${news.id}`;
  const shortUrl = await shortenUrl(longUrl);

  return [
    `${v.emoji} ${v.hook}`,
    ``,
    `${news.title}`,
    ``,
    reasoning ? `🤖 "${reasoning}"` : null,
    ``,
    `┌─────────────────────────┐`,
    `│  📊 Score: ${score}/100 ${sIcon} ${sLabel}`,
    `│`,
    `│  🎯 Precisión:     ${news.score_factual || 0}%`,
    `│  📚 Fuentes:       ${news.score_source_div || 0}%`,
    `│  🔍 Transparencia: ${news.score_transparency || 0}%`,
    `│  🏛️ Independencia:  ${news.score_independence || 0}%`,
    `│`,
    `│  ⚖️ Sesgo: ${bLabel}`,
    `│     Izq ${l}% · Centro ${c}% · Der ${r}%`,
    `│`,
    `│  🗞️ ${news.source_label} ${news.country}`,
    `│  📡 ${sources} fuente${sources > 1 ? "s" : ""}`,
    `└─────────────────────────┘`,
    ``,
    `👉 Análisis completo: ${shortUrl}`,
    ``,
    `· · ·`,
    `Filtramos el ruido. Entregamos la verdad.`,
    `🌐 contextoclaro.com`,
    ``,
    `#ContextoClaro #FakeNews #NoticiasFalsas #Venezuela #Colombia #IA #LATAM`,
  ].filter((x) => x !== null).join("\n");
}

// ══════════════════════════════════════════════════════════
// NEWS SELECTION — Never repeat, prioritize impactful
// ══════════════════════════════════════════════════════════

function selectNews(list: any[], postedIds: Set<number>): any | null {
  // Filter out already posted
  const available = list.filter((n: any) => !postedIds.has(n.id));
  if (!available.length) return null;

  // Priority 1: fake/misleading (most engaging)
  const impactful = available.filter((n: any) =>
    n.gemini_verdict === "fake" || n.gemini_verdict === "misleading"
  );
  if (impactful.length) return impactful[0];

  // Priority 2: highest score (most credible)
  const sorted = [...available].sort((a: any, b: any) => computeScore(b) - computeScore(a));
  return sorted[0];
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

serve(async (_req: Request) => {
  const t0 = Date.now();

  try {
    if (!BUFFER_API_KEY) return json({ success: false, error: "BUFFER_ACCESS_TOKEN not set" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Get channels
    const channels = await getChannels();
    if (!channels.length) return json({ success: false, error: "No Buffer channels found" });
    const channelNames = channels.map((ch) => `${ch.service}:${ch.name}`);
    console.log(`[buffer] Channels: ${channelNames.join(", ")}`);

    // 2. Get IDs of news already posted (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: posted } = await supabase
      .from("social_posts")
      .select("news_id")
      .gte("posted_at", sevenDaysAgo);
    const postedIds = new Set((posted || []).map((p: any) => p.news_id));
    console.log(`[buffer] Already posted ${postedIds.size} news in last 7 days`);

    // 3. Get recent verified news (last 48h, more pool to avoid repeats)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    let { data: news } = await supabase.from("news").select("*")
      .not("gemini_verdict", "is", null).not("image", "is", null)
      .in("country_code", ["VE", "CO", "TECH"])
      .gte("published_at", twoDaysAgo)
      .order("published_at", { ascending: false }).limit(30);

    if (!news?.length) {
      const { data: fb } = await supabase.from("news").select("*")
        .not("gemini_verdict", "is", null).not("image", "is", null)
        .in("country_code", ["VE", "CO", "TECH"])
        .order("published_at", { ascending: false }).limit(20);
      news = fb;
    }
    if (!news?.length) return json({ success: false, error: "No news found" });

    // 4. Select news that hasn't been posted
    const selected = selectNews(news, postedIds);
    if (!selected) return json({ success: false, error: "All recent news already posted — waiting for new articles" });

    const caption = await generateCaption(selected);
    const altText = `${selected.title} — Score: ${computeScore(selected)}/100`;

    console.log(`[buffer] Selected #${selected.id}: "${selected.title.substring(0, 50)}..." [${selected.gemini_verdict}]`);

    // 3. Scrape images from article source (for TikTok slideshow)
    let slideImages: string[] = [selected.image];
    if (selected.source_url) {
      console.log(`[buffer] Scraping images from: ${selected.source_url.substring(0, 80)}...`);
      slideImages = await scrapeArticleImages(selected.source_url, selected.image);
      console.log(`[buffer] Found ${slideImages.length} images`);
    }

    // 4. Resize and upload images to Supabase Storage
    const uploadedUrls: string[] = [];
    for (let i = 0; i < slideImages.length; i++) {
      const url = await resizeAndUpload(supabase, slideImages[i], selected.id, i);
      if (url) uploadedUrls.push(url);
    }
    console.log(`[buffer] Uploaded ${uploadedUrls.length} resized images to storage`);

    // Ensure we have at least 3 images for slideshow (pad with main if needed)
    const mainResized = uploadedUrls[0];
    while (uploadedUrls.length < 3 && mainResized) {
      uploadedUrls.push(mainResized);
    }

    // 5. Post to each channel
    const results: any[] = [];

    for (const channel of channels) {
      console.log(`[buffer] Posting to ${channel.service}: ${channel.name}...`);

      if (channel.service === "youtube") {
        // YouTube: requires video — skip with explanation
        results.push({ channel: `${channel.service}:${channel.name}`, success: false, error: "Skipped: YouTube requires video (Buffer API limitation)" });
        continue;
      }

      if (channel.service === "tiktok") {
        // TikTok: multi-image slideshow with resized images from Storage
        if (uploadedUrls.length < 1) {
          results.push({ channel: `${channel.service}:${channel.name}`, success: false, error: "No resized images available" });
          continue;
        }

        const input: any = {
          channelId: channel.id,
          text: caption,
          schedulingType: "automatic",
          mode: "addToQueue",
          assets: {
            images: uploadedUrls.map((url, i) => ({
              url,
              thumbnailUrl: url,
              metadata: { altText: i === 0 ? altText.substring(0, 200) : `Slide ${i + 1}: ${selected.title.substring(0, 100)}` },
            })),
          },
          aiAssisted: true,
          source: "contexto-claro-bot",
        };

        const r = await postToChannel(input);
        results.push({ channel: `${channel.service}:${channel.name}`, ...r, images: uploadedUrls.length });
        continue;
      }

      if (channel.service === "instagram") {
        // Instagram: single image post (or carousel if multiple images)
        const images = uploadedUrls.length >= 2
          ? uploadedUrls.slice(0, 6).map((url, i) => ({
              url,
              thumbnailUrl: url,
              metadata: { altText: i === 0 ? altText.substring(0, 200) : `Slide ${i + 1}` },
            }))
          : [{
              url: uploadedUrls[0] || selected.image,
              thumbnailUrl: uploadedUrls[0] || selected.image,
              metadata: { altText: altText.substring(0, 200) },
            }];

        const igType = uploadedUrls.length >= 2 ? "carousel" : "post";
        const input: any = {
          channelId: channel.id,
          text: caption,
          schedulingType: "automatic",
          mode: "addToQueue",
          assets: { images },
          metadata: { instagram: { type: igType, shouldShareToFeed: true } },
          aiAssisted: true,
          source: "contexto-claro-bot",
        };

        const r = await postToChannel(input);
        results.push({ channel: `${channel.service}:${channel.name}`, ...r, type: igType, images: images.length });
        continue;
      }

      if (channel.service === "threads") {
        // Threads: max 500 characters
        const v = { real: "✅", misleading: "⚠️", fake: "🚫", unverified: "❓" }[selected.gemini_verdict] || "❓";
        const vLabel = { real: "VERIFICADA", misleading: "ENGAÑOSA", fake: "FALSA", unverified: "SIN VERIFICAR" }[selected.gemini_verdict] || "SIN VERIFICAR";
        const sc = computeScore(selected);
        const longUrl = `https://contextoclaro.com/noticia/${slugify(selected.title)}-${selected.id}`;
        const shortUrl = await shortenUrl(longUrl);
        const threadsCaption = `${v} ${vLabel} · Score: ${sc}/100\n\n${selected.title}\n\n👉 ${shortUrl}\n\n#ContextoClaro #FakeNews #Venezuela #Colombia`;

        const input: any = {
          channelId: channel.id,
          text: threadsCaption.substring(0, 499),
          schedulingType: "automatic",
          mode: "addToQueue",
          assets: {
            images: [{ url: uploadedUrls[0] || selected.image, thumbnailUrl: uploadedUrls[0] || selected.image, metadata: { altText: altText.substring(0, 200) } }],
          },
          aiAssisted: true,
          source: "contexto-claro-bot",
        };
        const r = await postToChannel(input);
        results.push({ channel: `${channel.service}:${channel.name}`, ...r });
        continue;
      }

      // Other platforms (Facebook, Twitter, etc.)
      const input: any = {
        channelId: channel.id,
        text: caption,
        schedulingType: "automatic",
        mode: "addToQueue",
        assets: {
          images: [{ url: uploadedUrls[0] || selected.image, thumbnailUrl: uploadedUrls[0] || selected.image, metadata: { altText: altText.substring(0, 200) } }],
        },
        aiAssisted: true,
        source: "contexto-claro-bot",
      };
      const r = await postToChannel(input);
      results.push({ channel: `${channel.service}:${channel.name}`, ...r });
    }

    const successCount = results.filter((r) => r.success).length;

    // 6. Register posted news to avoid repeats
    if (successCount > 0) {
      for (const r of results) {
        if (r.success) {
          const platform = r.channel.split(":")[0];
          await supabase.from("social_posts").upsert({
            news_id: selected.id,
            platform,
            buffer_post_id: r.postId || null,
          }, { onConflict: "news_id,platform" }).then(() => {});
        }
      }
      console.log(`[buffer] Registered news #${selected.id} as posted`);
    }

    return json({
      success: successCount > 0,
      posted: `${successCount}/${channels.length}`,
      news_id: selected.id,
      news_title: selected.title,
      verdict: selected.gemini_verdict,
      score: computeScore(selected),
      images_scraped: slideImages.length,
      images_uploaded: uploadedUrls.length,
      channels: channelNames,
      results,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    console.error(`[buffer] Error: ${e}`);
    return json({ success: false, error: String(e), duration_ms: Date.now() - t0 });
  }
});

function json(data: any): Response {
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
}
