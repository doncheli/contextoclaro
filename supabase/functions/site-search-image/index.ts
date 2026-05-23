// supabase/functions/site-search-image/index.ts
// Para noticias sin imagen, busca en el sitio fuente por título → encuentra
// el artículo original → extrae og:image. Guarda image y source_url actualizado.
//
// Query params:
//   ?limit=10
//   ?dry_run=1
//   ?news_id=N

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "Mozilla/5.0 (compatible; ContextoClaroBot/1.0; +https://contextoclaro.com)";

// Mapping de source_label → patrón de búsqueda. La mayoría son WordPress (/?s=).
const SEARCH_PATTERNS: Record<string, { url: (q: string) => string; domain: string }> = {
  "La Patilla":           { url: q => `https://www.lapatilla.com/?s=${q}`, domain: "lapatilla.com" },
  "Runrunes":             { url: q => `https://runrun.es/?s=${q}`, domain: "runrun.es" },
  "El Nacional":          { url: q => `https://www.elnacional.com/?s=${q}`, domain: "elnacional.com" },
  "TechCrunch":           { url: q => `https://techcrunch.com/?s=${q}`, domain: "techcrunch.com" },
  "La Silla Vacía":       { url: q => `https://www.lasillavacia.com/?s=${q}`, domain: "lasillavacia.com" },
  "Infobae":              { url: q => `https://www.infobae.com/search/?query=${q}`, domain: "infobae.com" },
  "El Tiempo":            { url: q => `https://www.eltiempo.com/buscar?q=${q}`, domain: "eltiempo.com" },
  "Semana":               { url: q => `https://www.semana.com/buscador/?keywords=${q}`, domain: "semana.com" },
  "El Espectador":        { url: q => `https://www.elespectador.com/buscar/?q=${q}`, domain: "elespectador.com" },
  "Noticias Caracol":     { url: q => `https://www.noticiascaracol.com/search?q=${q}`, domain: "noticiascaracol.com" },
  "El Universal":         { url: q => `https://www.eluniversal.com/search?q=${q}`, domain: "eluniversal.com" },
  "Efecto Cocuyo":        { url: q => `https://efectococuyo.com/?s=${q}`, domain: "efectococuyo.com" },
  "Tal Cual":             { url: q => `https://talcualdigital.com/?s=${q}`, domain: "talcualdigital.com" },
  "ultimasnoticias.com.ve": { url: q => `https://ultimasnoticias.com.ve/?s=${q}`, domain: "ultimasnoticias.com.ve" },
  "Correo del Caroní":    { url: q => `https://correodelcaroni.com/?s=${q}`, domain: "correodelcaroni.com" },
  "El Diario":            { url: q => `https://eldiario.com/?s=${q}`, domain: "eldiario.com" },
  "El Pitazo":            { url: q => `https://elpitazo.net/?s=${q}`, domain: "elpitazo.net" },
  "Blu Radio":            { url: q => `https://www.bluradio.com/buscar?q=${q}`, domain: "bluradio.com" },
  "Hipertextual":         { url: q => `https://hipertextual.com/?s=${q}`, domain: "hipertextual.com" },
  "CNN en Español":       { url: q => `https://cnnespanol.cnn.com/?s=${q}`, domain: "cnnespanol.cnn.com" },
  "EL PAÍS":              { url: q => `https://elpais.com/buscador/?qt=${q}`, domain: "elpais.com" },
  "BBC":                  { url: q => `https://www.bbc.com/news/search?q=${q}`, domain: "bbc.com" },
};

function extractFirstArticleUrl(html: string, domain: string): string | null {
  // Busca el primer <a href="..."> que apunte al mismo dominio y parezca un artículo
  // (URL con suficiente profundidad, no es home ni categoría)
  const regex = /<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1];
    if (!url.includes(domain)) continue;
    // Filtrar home, categorías, búsqueda, tags
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    if (path === '/' || path === '' || path.length < 15) continue;
    if (/^\/(category|categoria|tag|etiqueta|search|buscar|page|author)\//i.test(path)) continue;
    if (path.includes('?s=') || path.includes('?q=') || path.includes('/search')) continue;
    // Heurística: artículos suelen tener > 30 chars en el path o terminar en algo descriptivo
    if (path.length > 25 || /\.html?$/.test(path) || /\/\d{4}\//.test(path)) {
      return url;
    }
  }
  return null;
}

function extractOgImage(html: string): string | null {
  let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)/i)
    || html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i)
    || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["'](https?:\/\/[^"']+)/i);
  if (m?.[1]) return m[1];
  // JSON-LD
  m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
  if (m?.[1]) return m[1];
  return null;
}

async function searchAndExtract(title: string, sourceLabel: string): Promise<{ url: string; image: string } | null> {
  const pattern = SEARCH_PATTERNS[sourceLabel];
  if (!pattern) return null;

  // Limpiar título: tomar primeras ~8 palabras, sin puntuación
  const query = title.replace(/[^\w\sáéíóúñÁÉÍÓÚÑüÜ]/g, ' ').split(/\s+/).slice(0, 8).join(' ').trim();
  if (!query) return null;

  const searchUrl = pattern.url(encodeURIComponent(query));

  let searchHtml: string;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(searchUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    searchHtml = await resp.text();
  } catch { return null; }

  const articleUrl = extractFirstArticleUrl(searchHtml, pattern.domain);
  if (!articleUrl) return null;

  // Fetch del artículo para og:image
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(articleUrl, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const html = await resp.text();
    const image = extractOgImage(html);
    if (!image) return null;
    // Filtrar genéricos (logos, default site image)
    if (image.includes("logo") || image.includes("default") || image.endsWith(".svg")) return null;
    return { url: articleUrl, image };
  } catch { return null; }
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)));
  const dryRun = url.searchParams.get("dry_run") === "1";
  const forcedNewsId = url.searchParams.get("news_id");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Seleccionar noticias sin imagen y con source_label conocido
  let q = supabase
    .from("news")
    .select("id, title, source_label")
    .is("image", null)
    .not("source_label", "is", null)
    .in("country_code", ["VE", "CO", "TECH"])
    .order("published_at", { ascending: false });

  if (forcedNewsId) {
    q = q.eq("id", forcedNewsId).limit(1);
  } else {
    q = q.limit(limit);
  }

  const { data: rows, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!rows?.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const supportedSources = new Set(Object.keys(SEARCH_PATTERNS));
  const toProcess = rows.filter(r => supportedSources.has(r.source_label));

  const results: Array<{ id: number; source: string; status: string; image?: string; url?: string }> = [];
  let updated = 0;

  for (const row of toProcess) {
    const found = await searchAndExtract(row.title, row.source_label);
    if (!found) {
      results.push({ id: row.id, source: row.source_label, status: "NOT_FOUND" });
      continue;
    }

    if (!dryRun) {
      const { error: updErr } = await supabase
        .from("news")
        .update({ image: found.image, source_url: found.url })
        .eq("id", row.id);
      if (!updErr) {
        updated++;
        results.push({ id: row.id, source: row.source_label, status: "UPDATED", image: found.image, url: found.url });
      } else {
        results.push({ id: row.id, source: row.source_label, status: "UPDATE_ERR" });
      }
    } else {
      results.push({ id: row.id, source: row.source_label, status: "DRY_RUN", image: found.image, url: found.url });
    }
    await new Promise(r => setTimeout(r, 300)); // rate limit gentil
  }

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    candidates: rows.length,
    processable: toProcess.length,
    updated,
    sourcesSupported: Object.keys(SEARCH_PATTERNS),
    results: results.slice(0, 15),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
