// supabase/functions/backfill-og-image/index.ts
// Recupera la imagen ORIGINAL de cada noticia desde el sitio fuente.
// Para noticias con source_url IS NOT NULL e imagen genérica/null,
// hace fetch de la página y extrae og:image / twitter:image / first <img>.
//
// Query params:
//   ?limit=20         — cuántas procesar (default 20, max 50)
//   ?dry_run=1
//   ?force=1          — sobrescribir incluso si ya tiene imagen no genérica

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UA = "Mozilla/5.0 (compatible; ContextoClaro/1.0; +https://contextoclaro.com)";

// Genéricas: si la imagen actual matchea estos patrones, considerarla "no original"
const GENERIC_PATTERNS = [
  /^https:\/\/images\.unsplash\.com\//,
  /^https:\/\/source\.unsplash\.com\//,
  /\.svg(\?|$)/i,
  /placeholder/i,
];

function isGeneric(url: string | null | undefined): boolean {
  if (!url) return true;
  return GENERIC_PATTERNS.some((p) => p.test(url));
}

async function extractImage(sourceUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(sourceUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(t);

    if (!resp.ok) return null;
    const ctype = resp.headers.get("content-type") || "";
    if (!ctype.includes("html")) return null;

    const html = await resp.text();

    // 1. og:image (property o name)
    let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)/i)
      || html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i)
      || html.match(/<meta[^>]+name=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)/i);
    if (m && m[1]) return m[1];

    // 2. og:image:secure_url
    m = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["'](https?:\/\/[^"']+)/i);
    if (m && m[1]) return m[1];

    // 3. twitter:image
    m = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["'](https?:\/\/[^"']+)/i)
      || html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (m && m[1]) return m[1];

    // 4. JSON-LD NewsArticle.image
    m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
    if (m && m[1]) return m[1];

    // 5. First large <img> (last resort)
    m = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
    if (m && m[1]) return m[1];

    return null;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const dryRun = url.searchParams.get("dry_run") === "1";
  const force = url.searchParams.get("force") === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Selecciona noticias con source_url, ordenadas por más recientes
  const { data: rows, error: selectErr } = await supabase
    .from("news")
    .select("id, title, source_url, image")
    .not("source_url", "is", null)
    .in("country_code", ["VE", "CO", "TECH"])
    .order("published_at", { ascending: false })
    .limit(limit * 3); // sobre-fetch para filtrar las que ya tienen imagen original

  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  // Filtra las que necesitan reproceso
  const toProcess = rows
    .filter((r) => force || isGeneric(r.image))
    .slice(0, limit);

  let updated = 0;
  let failed = 0;
  const results: Array<{ id: number; source: string; old: string; newImage: string | null }> = [];

  for (const news of toProcess) {
    const fetched = await extractImage(news.source_url);
    if (!fetched) {
      failed++;
      results.push({ id: news.id, source: news.source_url, old: news.image || "NULL", newImage: null });
      continue;
    }

    if (!dryRun) {
      const { error: updErr } = await supabase
        .from("news")
        .update({ image: fetched })
        .eq("id", news.id);
      if (!updErr) updated++;
    }

    results.push({ id: news.id, source: news.source_url, old: news.image || "NULL", newImage: fetched });

    // Rate limit gentil
    await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    candidates: rows.length,
    processed: toProcess.length,
    updated,
    failed,
    results: results.slice(0, 10),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
