// supabase/functions/send-newsletter/index.ts
// Edge Function: "El Filtro" — Newsletter semanal automático
// Genera contenido desde la DB y envía via Resend
// Ejecutar cada domingo a las 9am via cron

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("NEWSLETTER_FROM") || "Contexto Claro <onboarding@resend.dev>";

// ══════════════════════════════════════════════════════════
// FETCH NEWSLETTER CONTENT FROM DB
// ══════════════════════════════════════════════════════════

interface NewsItem {
  id: number;
  title: string;
  source_label: string;
  country: string;
  gemini_verdict: string;
  gemini_confidence: number;
  gemini_reasoning: string;
  bias_left: number;
  bias_center: number;
  bias_right: number;
  score_factual: number;
  score_source_div: number;
  score_transparency: number;
  score_independence: number;
  published_at: string;
  sponsored_flag: string | null;
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function computeScore(n: NewsItem): number {
  return Math.round(n.score_factual * 0.35 + n.score_source_div * 0.25 + n.score_transparency * 0.25 + n.score_independence * 0.15);
}

async function getWeeklyContent(supabase: any) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Top 3 fake/misleading news
  const { data: fakeNews } = await supabase
    .from("news")
    .select("*")
    .in("gemini_verdict", ["fake", "misleading"])
    .in("country_code", ["VE", "CO", "TECH"])
    .gte("published_at", weekAgo)
    .order("gemini_confidence", { ascending: false })
    .limit(3);

  // Top verified real news
  const { data: topReal } = await supabase
    .from("news")
    .select("*")
    .eq("gemini_verdict", "real")
    .in("country_code", ["VE", "CO", "TECH"])
    .gte("published_at", weekAgo)
    .order("source_count", { ascending: false })
    .limit(3);

  // Sponsored/propaganda detected
  const { data: sponsored } = await supabase
    .from("news")
    .select("*")
    .not("sponsored_flag", "is", null)
    .in("country_code", ["VE", "CO", "TECH"])
    .gte("published_at", weekAgo)
    .order("published_at", { ascending: false })
    .limit(2);

  // Weekly stats
  const { data: allWeek } = await supabase
    .from("news")
    .select("gemini_verdict, bias_label, sponsored_flag")
    .in("country_code", ["VE", "CO", "TECH"])
    .gte("published_at", weekAgo);

  const rows = allWeek || [];
  const stats = {
    total: rows.length,
    real: rows.filter((r: any) => r.gemini_verdict === "real").length,
    fake: rows.filter((r: any) => r.gemini_verdict === "fake").length,
    misleading: rows.filter((r: any) => r.gemini_verdict === "misleading").length,
    sponsored: rows.filter((r: any) => r.sponsored_flag).length,
    biasLeft: rows.filter((r: any) => r.bias_label === "IZQUIERDA").length,
    biasRight: rows.filter((r: any) => r.bias_label === "DERECHA").length,
  };

  return {
    fakeNews: fakeNews || [],
    topReal: topReal || [],
    sponsored: sponsored || [],
    stats,
  };
}

// ══════════════════════════════════════════════════════════
// GENERATE HTML EMAIL
// ══════════════════════════════════════════════════════════

function verdictBadge(verdict: string): string {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    fake: { bg: "#fef2f2", text: "#b91c1c", label: "🚨 FALSA" },
    misleading: { bg: "#fffbeb", text: "#b45309", label: "⚠️ ENGAÑOSA" },
    real: { bg: "#ecfdf5", text: "#047857", label: "✅ REAL" },
  };
  const c = colors[verdict] || colors.real;
  return `<span style="background:${c.bg};color:${c.text};padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">${c.label}</span>`;
}

function generateEmailHtml(content: any): string {
  const { fakeNews, topReal, sponsored, stats } = content;
  const date = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  const newsCard = (n: NewsItem) => {
    const score = computeScore(n);
    const url = `https://contextoclaro.com/noticia/${slugify(n.title)}-${n.id}`;
    const biasDesc = n.bias_left > 50 ? "Izquierda" : n.bias_right > 50 ? "Derecha" : "Centro/Equilibrado";
    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:12px;">
        <div style="margin-bottom:8px;">${verdictBadge(n.gemini_verdict)} <span style="color:#6b7280;font-size:11px;margin-left:8px;">${n.country} ${n.source_label}</span></div>
        <h3 style="margin:0 0 8px;font-size:16px;color:#1a2a3a;line-height:1.4;"><a href="${url}" style="color:#1b4f72;text-decoration:none;">${n.title}</a></h3>
        <div style="font-size:12px;color:#6b7280;">Score: <strong>${score}/100</strong> · Sesgo: <strong>${biasDesc}</strong> · ${n.gemini_confidence}% confianza</div>
        ${n.gemini_reasoning ? `<p style="font-size:12px;color:#4b5563;margin:8px 0 0;line-height:1.5;">${n.gemini_reasoning.split("|")[0].trim().substring(0, 150)}...</p>` : ""}
      </div>`;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="background:#1b4f72;border-radius:16px 16px 0 0;padding:30px 24px;text-align:center;">
      <img src="https://contextoclaro.com/logo.png" alt="Contexto Claro" width="200" style="display:block;margin:0 auto 12px;" />
      <h1 style="color:#fff;margin:0;font-size:24px;">El Filtro</h1>
      <p style="color:#2bb5b2;margin:4px 0 0;font-size:14px;">Resumen semanal · ${date}</p>
    </div>

    <div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;border:1px solid #e5e7eb;border-top:0;">

      <!-- Stats -->
      <div style="background:#f5f7fa;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:600;">ESTA SEMANA ANALIZAMOS</p>
        <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">
          <div><span style="font-size:24px;font-weight:800;color:#1b4f72;">${stats.total}</span><br><span style="font-size:10px;color:#6b7280;">noticias</span></div>
          <div><span style="font-size:24px;font-weight:800;color:#b91c1c;">${stats.fake}</span><br><span style="font-size:10px;color:#6b7280;">falsas</span></div>
          <div><span style="font-size:24px;font-weight:800;color:#b45309;">${stats.misleading}</span><br><span style="font-size:10px;color:#6b7280;">engañosas</span></div>
          <div><span style="font-size:24px;font-weight:800;color:#047857;">${stats.real}</span><br><span style="font-size:10px;color:#6b7280;">reales</span></div>
        </div>
      </div>

      <!-- Fake news section -->
      ${fakeNews.length > 0 ? `
        <h2 style="font-size:18px;color:#b91c1c;margin:0 0 12px;border-bottom:2px solid #fecaca;padding-bottom:8px;">🚨 Noticias Falsas y Engañosas</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Las más peligrosas de la semana — no caigas en la trampa.</p>
        ${fakeNews.map(newsCard).join("")}
      ` : ""}

      <!-- Top verified -->
      ${topReal.length > 0 ? `
        <h2 style="font-size:18px;color:#047857;margin:24px 0 12px;border-bottom:2px solid #a7f3d0;padding-bottom:8px;">✅ Noticias Verificadas</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Las más cubiertas y confiables de la semana.</p>
        ${topReal.map(newsCard).join("")}
      ` : ""}

      <!-- Sponsored alert -->
      ${sponsored.length > 0 ? `
        <h2 style="font-size:18px;color:#2bb5b2;margin:24px 0 12px;border-bottom:2px solid #99f6e4;padding-bottom:8px;">💰 Propaganda Detectada</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Contenido que parece periodismo pero es publicidad.</p>
        ${sponsored.map(newsCard).join("")}
      ` : ""}

      <!-- Bias stat -->
      <div style="background:#f5f7fa;border-radius:12px;padding:16px;margin-top:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;">SESGO DE LA SEMANA</p>
        <p style="margin:0;font-size:13px;color:#4b5563;">
          ${stats.biasLeft > stats.biasRight ? `La cobertura se inclinó a la <strong style="color:#dc2626;">izquierda</strong> (${stats.biasLeft} noticias)` :
            stats.biasRight > stats.biasLeft ? `La cobertura se inclinó a la <strong style="color:#1b4f72;">derecha</strong> (${stats.biasRight} noticias)` :
            `La cobertura estuvo <strong>equilibrada</strong> esta semana`}
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:30px;">
        <a href="https://contextoclaro.com" style="display:inline-block;background:#1b4f72;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">
          Ver todas las noticias verificadas
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;font-size:11px;color:#9ca3af;">
      <p style="margin:0 0 4px;">Filtramos el ruido. Entregamos la verdad.</p>
      <p style="margin:0 0 8px;"><a href="https://contextoclaro.com" style="color:#2bb5b2;">contextoclaro.com</a> · @doncheli</p>
      <p style="margin:0;"><a href="https://contextoclaro.com/unsubscribe?email={{email}}" style="color:#9ca3af;">Cancelar suscripción</a></p>
    </div>

  </div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════
// SEND VIA RESEND
// ══════════════════════════════════════════════════════════

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[resend] Failed for ${to}: ${err}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[resend] Error for ${to}: ${e}`);
    return false;
  }
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

serve(async (_req: Request) => {
  const startTime = Date.now();

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not set" }), { headers: { "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get active subscribers
    const { data: subscribers, error: subErr } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .eq("active", true);

    if (subErr || !subscribers?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: `No active subscribers (${subscribers?.length || 0})`,
        duration_ms: Date.now() - startTime,
      }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Generate content from DB
    const content = await getWeeklyContent(supabase);
    const date = new Date().toLocaleDateString("es", { day: "numeric", month: "long" });
    const subject = `🔍 El Filtro — ${content.stats.fake} noticias falsas esta semana (${date})`;
    const html = generateEmailHtml(content);

    // 3. Send to all subscribers (batch, 2/sec to respect Resend free tier)
    let sent = 0, failed = 0;
    for (const sub of subscribers) {
      const personalHtml = html.replace("{{email}}", encodeURIComponent(sub.email));
      const ok = await sendEmail(sub.email, subject, personalHtml);
      if (ok) sent++; else failed++;
      // Rate limit: 2 emails/second on free tier
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      success: true,
      subscribers: subscribers.length,
      sent,
      failed,
      subject,
      stats: content.stats,
      duration_ms: Date.now() - startTime,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e), duration_ms: Date.now() - startTime }), { headers: { "Content-Type": "application/json" } });
  }
});
