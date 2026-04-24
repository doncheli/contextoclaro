import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://contextoclaro.com";

function slugify(text: string): string {
  return (text || "articulo")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function articleUrl(id: number | string, title: string): string {
  return `${SITE_URL}/noticia/${slugify(title)}-${id}`;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "main";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (type === "news") {
    const { data: articles } = await supabase
      .from("news")
      .select("id, title, published_at, source_label, country_code, category")
      .in("country_code", ["VE", "CO"])
      .gte("published_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("published_at", { ascending: false })
      .limit(1000);

    const items = (articles || []).map((a: any) => {
      const pubDate = new Date(a.published_at).toISOString();
      const keywords = (a.category || "").replace(/ · /g, ", ").toLowerCase();
      return `  <url>\n    <loc>${articleUrl(a.id, a.title)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>Contexto Claro</news:name>\n        <news:language>es</news:language>\n      </news:publication>\n      <news:publication_date>${pubDate}</news:publication_date>\n      <news:title><![CDATA[${a.title}]]></news:title>\n      <news:keywords>${keywords}</news:keywords>\n    </news:news>\n  </url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${items.join("\n")}\n</urlset>`;
    return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=1800" } });
  }

  if (type === "rss") {
    const { data: articles } = await supabase
      .from("news")
      .select("id, title, description, published_at, source_label, country_code, image, gemini_verdict")
      .in("country_code", ["VE", "CO"])
      .order("published_at", { ascending: false })
      .limit(50);

    const items = (articles || []).map((a: any) => {
      const pubDate = new Date(a.published_at).toUTCString();
      const desc = (a.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const link = articleUrl(a.id, a.title);
      return `    <item>\n      <title><![CDATA[${a.title}]]></title>\n      <link>${link}</link>\n      <guid isPermaLink="true">${link}</guid>\n      <description><![CDATA[${desc}]]></description>\n      <pubDate>${pubDate}</pubDate>\n      <source url="${SITE_URL}">Contexto Claro</source>${a.image ? `\n      <enclosure url="${a.image}" type="image/jpeg" />` : ""}\n    </item>`;
    });

    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>Contexto Claro — Noticias Verificadas de LATAM</title>\n    <link>${SITE_URL}</link>\n    <description>Noticias de Venezuela y Colombia verificadas por IA. Analiza sesgo, detecta fake news y contenido patrocinado.</description>\n    <language>es</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />\n    <image>\n      <url>${SITE_URL}/logo.png</url>\n      <title>Contexto Claro</title>\n      <link>${SITE_URL}</link>\n    </image>\n${items.join("\n")}\n  </channel>\n</rss>`;
    return new Response(rss, { headers: { "Content-Type": "application/rss+xml", "Cache-Control": "public, max-age=1800" } });
  }

  // Main sitemap
  const { data: articles } = await supabase
    .from("news")
    .select("id, title, published_at")
    .in("country_code", ["VE", "CO"])
    .order("published_at", { ascending: false })
    .limit(5000);

  const staticPages = [
    { loc: SITE_URL, priority: "1.0", changefreq: "always" },
    { loc: `${SITE_URL}/about.html`, priority: "0.6", changefreq: "monthly" },
    { loc: `${SITE_URL}/methodology.html`, priority: "0.7", changefreq: "monthly" },
    { loc: `${SITE_URL}/contact.html`, priority: "0.4", changefreq: "yearly" },
    { loc: `${SITE_URL}/terms.html`, priority: "0.3", changefreq: "yearly" },
    { loc: `${SITE_URL}/privacy.html`, priority: "0.3", changefreq: "yearly" },
  ];

  const staticXml = staticPages.map(p => `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`).join("\n");

  const articleXml = (articles || []).map((a: any) => {
    const lastmod = new Date(a.published_at).toISOString();
    return `  <url>\n    <loc>${articleUrl(a.id, a.title)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}\n${articleXml}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
});
