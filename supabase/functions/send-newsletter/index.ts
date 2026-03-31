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

function fmtNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

function verdictBadge(verdict: string): string {
  const c: Record<string, { bg: string; text: string; border: string; label: string }> = {
    fake:       { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", label: "FALSA" },
    misleading: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "ENGAÑOSA" },
    real:       { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", label: "VERIFICADA" },
  };
  const v = c[verdict] || c.real;
  return `<td style="background:${v.bg};color:${v.text};border:1px solid ${v.border};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.5px;">${v.label}</td>`;
}

function scoreBar(score: number): string {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1b4f72" : score >= 40 ? "#d97706" : "#dc2626";
  return `<td style="padding:0 8px;vertical-align:middle;width:100%;">
    <div style="background:#e5e7eb;border-radius:10px;height:6px;width:100%;"><div style="background:${color};border-radius:10px;height:6px;width:${score}%;"></div></div>
  </td>
  <td style="font-size:13px;font-weight:800;color:${color};white-space:nowrap;padding-left:6px;">${score}</td>`;
}

function generateEmailHtml(content: any): string {
  const { fakeNews, topReal, sponsored, stats } = content;
  const date = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  const newsCard = (n: NewsItem, idx: number) => {
    const score = computeScore(n);
    const url = `https://contextoclaro.com/noticia/${slugify(n.title)}-${n.id}`;
    const biasDesc = n.bias_left > 50 ? "Izquierda" : n.bias_right > 50 ? "Derecha" : "Equilibrado";
    const reasoning = n.gemini_reasoning ? n.gemini_reasoning.split("|")[0].trim().substring(0, 120) : "";
    return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
      <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:0;overflow:hidden;">
        <!-- Verdict strip -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:14px 18px 10px;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                ${verdictBadge(n.gemini_verdict)}
                <td style="padding-left:10px;font-size:11px;color:#9ca3af;">${n.country} ${n.source_label}</td>
                <td style="padding-left:10px;font-size:11px;color:#9ca3af;">${n.gemini_confidence}%</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 18px 8px;">
              <a href="${url}" style="color:#1a2a3a;text-decoration:none;font-size:16px;font-weight:700;line-height:1.35;display:block;">${n.title}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 18px 4px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td style="font-size:11px;color:#6b8299;width:40px;">Score</td>
                ${scoreBar(score)}
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 18px 6px;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="font-size:10px;color:#9ca3af;padding-right:12px;">Sesgo: <strong style="color:#4b5563;">${biasDesc}</strong></td>
              </tr></table>
            </td>
          </tr>
          ${reasoning ? `<tr><td style="padding:0 18px 14px;font-size:12px;color:#6b8299;line-height:1.5;border-top:1px solid #f3f4f6;padding-top:10px;">${reasoning}</td></tr>` : ""}
          <tr>
            <td style="padding:0 18px 14px;">
              <a href="${url}" style="color:#2bb5b2;font-size:12px;font-weight:600;text-decoration:none;">Leer análisis completo →</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
  };

  const statCell = (value: number, label: string, color: string) =>
    `<td style="text-align:center;padding:12px 4px;">
      <div style="font-size:28px;font-weight:800;color:${color};line-height:1;">${fmtNum(value)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </td>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>El Filtro — Contexto Claro</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<center>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;">

  <!-- Preheader (hidden text for inbox preview) -->
  <tr><td style="display:none;font-size:1px;color:#f0f2f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${fmtNum(stats.fake)} noticias falsas detectadas esta semana. ${fmtNum(stats.total)} analizadas por IA.
  </td></tr>

  <!-- Spacer -->
  <tr><td style="height:20px;"></td></tr>

  <!-- Header -->
  <tr><td style="background:#ffffff;border-radius:16px 16px 0 0;padding:32px 30px 24px;text-align:center;border:1px solid #e5e7eb;border-bottom:0;">
    <img src="https://contextoclaro.com/logo.png" alt="Contexto Claro" width="180" style="display:block;margin:0 auto 16px;" />
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#2bb5b2,transparent);"></td></tr>
    </table>
    <h1 style="margin:16px 0 0;font-size:26px;color:#1a2a3a;letter-spacing:-0.5px;">El Filtro</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#6b8299;">Resumen semanal · ${date}</p>
  </td></tr>

  <!-- Stats Bar -->
  <tr><td style="background:#1b4f72;padding:0;border-left:1px solid #164060;border-right:1px solid #164060;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      ${statCell(stats.total, "Analizadas", "#ffffff")}
      ${statCell(stats.fake, "Falsas", "#fca5a5")}
      ${statCell(stats.misleading, "Engañosas", "#fcd34d")}
      ${statCell(stats.real, "Reales", "#6ee7b7")}
    </tr></table>
  </td></tr>

  <!-- Main content -->
  <tr><td style="background:#ffffff;padding:28px 24px;border:1px solid #e5e7eb;border-top:0;">

    <!-- Intro -->
    <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 24px;">
      Esta semana nuestro sistema de IA analizó <strong style="color:#1b4f72;">${fmtNum(stats.total)} noticias</strong> de Venezuela, Colombia y tecnología mundial.
      Encontramos <strong style="color:#dc2626;">${stats.fake} falsas</strong> y <strong style="color:#d97706;">${stats.misleading} engañosas</strong>.
      Aquí tienes lo más importante.
    </p>

    ${fakeNews.length > 0 ? `
    <!-- Section: Fake News -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 16px;">
          <span style="font-size:15px;font-weight:800;color:#991b1b;">🚨 Alerta: Noticias Falsas</span>
          <span style="font-size:11px;color:#b91c1c;display:block;margin-top:2px;">No compartas sin verificar primero</span>
        </td>
      </tr>
    </table>
    ${fakeNews.map(newsCard).join("")}
    ` : ""}

    ${topReal.length > 0 ? `
    <!-- Section: Verified -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;margin-top:24px;">
      <tr>
        <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 16px;">
          <span style="font-size:15px;font-weight:800;color:#065f46;">✅ Noticias Verificadas</span>
          <span style="font-size:11px;color:#047857;display:block;margin-top:2px;">Las más cubiertas y confiables de la semana</span>
        </td>
      </tr>
    </table>
    ${topReal.map(newsCard).join("")}
    ` : ""}

    ${sponsored.length > 0 ? `
    <!-- Section: Sponsored -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;margin-top:24px;">
      <tr>
        <td style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 16px;">
          <span style="font-size:15px;font-weight:800;color:#0f766e;">💰 Propaganda Detectada</span>
          <span style="font-size:11px;color:#2bb5b2;display:block;margin-top:2px;">Contenido pagado disfrazado de periodismo</span>
        </td>
      </tr>
    </table>
    ${sponsored.map(newsCard).join("")}
    ` : ""}

    <!-- Bias of the week -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:10px;color:#9ca3af;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Sesgo de la semana</div>
        <!-- Bias bar -->
        <table cellpadding="0" cellspacing="0" border="0" width="80%" style="margin:0 auto;">
          <tr>
            <td style="background:#dc2626;height:8px;border-radius:4px 0 0 4px;width:${stats.biasLeft || 1}%;"></td>
            <td style="background:#e5e7eb;height:8px;width:${100 - (stats.biasLeft || 0) - (stats.biasRight || 0)}%;"></td>
            <td style="background:#1b4f72;height:8px;border-radius:0 4px 4px 0;width:${stats.biasRight || 1}%;"></td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="80%" style="margin:6px auto 0;">
          <tr>
            <td style="font-size:10px;color:#dc2626;font-weight:600;">Izq</td>
            <td style="font-size:10px;color:#9ca3af;font-weight:600;text-align:center;">Centro</td>
            <td style="font-size:10px;color:#1b4f72;font-weight:600;text-align:right;">Der</td>
          </tr>
        </table>
        <p style="font-size:12px;color:#6b8299;margin:10px 0 0;">
          ${stats.biasLeft > stats.biasRight ? `La cobertura se inclinó a la <strong style="color:#dc2626;">izquierda</strong> esta semana` :
            stats.biasRight > stats.biasLeft ? `La cobertura se inclinó a la <strong style="color:#1b4f72;">derecha</strong> esta semana` :
            `La cobertura estuvo <strong>equilibrada</strong> esta semana`}
        </p>
      </td></tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
      <tr><td style="text-align:center;">
        <a href="https://contextoclaro.com" style="display:inline-block;background:#1b4f72;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.3px;">
          Ver todas las noticias →
        </a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:24px;text-align:center;border:1px solid #e5e7eb;border-top:0;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1b4f72;">Filtramos el ruido. Entregamos la verdad.</p>
    <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;">
      <a href="https://contextoclaro.com" style="color:#2bb5b2;text-decoration:none;">contextoclaro.com</a> ·
      <a href="https://x.com/don_cheli" style="color:#9ca3af;text-decoration:none;">@don_cheli</a> ·
      <a href="https://youtube.com/@doncheli" style="color:#9ca3af;text-decoration:none;">YouTube</a> ·
      <a href="https://instagram.com/doncheli.tv" style="color:#9ca3af;text-decoration:none;">Instagram</a>
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="height:1px;background:#e5e7eb;"></td></tr>
    </table>
    <p style="margin:12px 0 0;font-size:10px;color:#c0c0c0;">
      Recibes este email porque te suscribiste a El Filtro de Contexto Claro.<br/>
      <a href="https://contextoclaro.com/unsubscribe?email={{email}}" style="color:#9ca3af;text-decoration:underline;">Cancelar suscripción</a>
    </p>
  </td></tr>

  <tr><td style="height:20px;"></td></tr>

</table>
</center>
</body></html>`;
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
