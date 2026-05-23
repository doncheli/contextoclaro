// supabase/functions/decode-html-entities/index.ts
// Backfill: decodifica entities HTML en news.title, news.description y article_paragraphs.content
// Procesa por lotes para no exceder timeout. Idempotente (solo actualiza si cambia).
//
// POST /functions/v1/decode-html-entities?table=news|paragraphs|all&limit=500

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Entities nombradas comunes (HTML 4 + 5 subset). Las numéricas se procesan con regex.
const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&apos;": "'", "&copy;": "©", "&reg;": "®",
  "&trade;": "™", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
  "&laquo;": "«", "&raquo;": "»", "&iquest;": "¿", "&iexcl;": "¡",
  "&ldquo;": '"', "&rdquo;": '"', "&lsquo;": "'", "&rsquo;": "'",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&ntilde;": "ñ", "&Ntilde;": "Ñ", "&uuml;": "ü", "&Uuml;": "Ü",
  "&euro;": "€", "&pound;": "£", "&yen;": "¥", "&cent;": "¢",
  "&middot;": "·", "&bull;": "•", "&times;": "×", "&divide;": "÷",
  "&deg;": "°", "&plusmn;": "±", "&sect;": "§", "&para;": "¶",
};

function decodeHtmlEntities(s: string | null): string | null {
  if (s == null) return s;
  let out = s;

  // Entities numéricas hex: &#xHHHH;
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
  });

  // Entities numéricas decimales: &#NNNN;
  out = out.replace(/&#(\d+);/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
  });

  // Entities nombradas
  for (const [k, v] of Object.entries(NAMED_ENTITIES)) {
    if (out.includes(k)) out = out.split(k).join(v);
  }

  return out;
}

// Heurística: una entity real es `&[a-zA-Z]{2,8};` o `&#\d{2,5};` o `&#x[0-9a-fA-F]{2,5};`
const ENTITY_RE = /&(?:[a-zA-Z]{2,8}|#\d{2,5}|#x[0-9a-fA-F]{2,5});/;

async function backfillNews(supabase: any, offset: number, limit: number) {
  const { data, error } = await supabase
    .from("news")
    .select("id, title, description")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return { error: error.message, updated: 0, scanned: 0 };

  const updates: Array<{ id: number; title: string | null; description: string | null }> = [];
  for (const row of data || []) {
    const tHas = row.title && ENTITY_RE.test(row.title);
    const dHas = row.description && ENTITY_RE.test(row.description);
    if (!tHas && !dHas) continue;
    const newTitle = tHas ? decodeHtmlEntities(row.title) : row.title;
    const newDesc = dHas ? decodeHtmlEntities(row.description) : row.description;
    if (newTitle !== row.title || newDesc !== row.description) {
      updates.push({ id: row.id, title: newTitle, description: newDesc });
    }
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25);
    const results = await Promise.all(chunk.map((u) =>
      supabase.from("news").update({ title: u.title, description: u.description }).eq("id", u.id)
    ));
    updated += results.filter((r: any) => !r.error).length;
  }
  return { updated, scanned: (data || []).length, hasMore: (data || []).length === limit };
}

async function backfillParagraphs(supabase: any, offset: number, limit: number) {
  const { data, error } = await supabase
    .from("article_paragraphs")
    .select("id, content")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return { error: error.message, updated: 0, scanned: 0 };

  const updates: Array<{ id: number; content: string }> = [];
  for (const row of data || []) {
    if (!row.content || !ENTITY_RE.test(row.content)) continue;
    const next = decodeHtmlEntities(row.content);
    if (next != null && next !== row.content) updates.push({ id: row.id, content: next });
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25);
    const results = await Promise.all(chunk.map((u) =>
      supabase.from("article_paragraphs").update({ content: u.content }).eq("id", u.id)
    ));
    updated += results.filter((r: any) => !r.error).length;
  }
  return { updated, scanned: (data || []).length, hasMore: (data || []).length === limit };
}

serve(async (req) => {
  const url = new URL(req.url);
  const table = url.searchParams.get("table") || "news";
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  // PostgREST limita a 1000 filas por request — no tiene sentido pedir más
  const limit = Math.min(1000, Math.max(50, parseInt(url.searchParams.get("limit") || "1000", 10)));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (table === "news") {
    const r = await backfillNews(supabase, offset, limit);
    return new Response(JSON.stringify({ ok: true, table, offset, limit, ...r }), { headers: { "Content-Type": "application/json" } });
  }
  if (table === "paragraphs") {
    const r = await backfillParagraphs(supabase, offset, limit);
    return new Response(JSON.stringify({ ok: true, table, offset, limit, ...r }), { headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: false, error: "table must be news or paragraphs" }), { status: 400, headers: { "Content-Type": "application/json" } });
});
