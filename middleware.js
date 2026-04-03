const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw'

const BOT_AGENTS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'googlebot', 'bingbot',
  'yandexbot', 'duckduckbot', 'applebot', 'pinterestbot',
  'redditbot', 'rogerbot', 'embedly', 'quora', 'outbrain',
  'vkshare', 'tumblr', 'w3c_validator',
]

export const config = {
  matcher: '/noticia/:path*',
}

export default async function middleware(req) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  const isBot = BOT_AGENTS.some(bot => ua.includes(bot))

  if (!isBot) return

  const url = new URL(req.url)
  const path = url.pathname
  const idMatch = path.match(/-(\d+)$/)

  if (!idMatch) return

  const newsId = idMatch[1]

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news?id=eq.${newsId}&select=id,title,description,image,category,country,gemini_verdict,gemini_confidence,score_factual,score_source_div,score_transparency,score_independence,source_count`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const data = await res.json()
    const news = data?.[0]

    if (!news) return

    const score = Math.round(
      (news.score_factual || 0) * 0.35 +
      (news.score_source_div || 0) * 0.25 +
      (news.score_transparency || 0) * 0.25 +
      (news.score_independence || 0) * 0.15
    )
    const verdictLabels = { real: 'Verificada', misleading: 'Engañosa', fake: 'Falsa', unverified: 'Sin verificar' }
    const verdictEmojis = { real: '✅', misleading: '⚠️', fake: '🚫', unverified: '❓' }
    const verdict = news.gemini_verdict || 'unverified'
    const vLabel = verdictLabels[verdict] || 'Sin verificar'
    const vEmoji = verdictEmojis[verdict] || '❓'

    const title = `${vEmoji} ${news.title}`
    const description = `${vLabel} (${news.gemini_confidence || 0}% confianza) · Puntuación: ${score}/100 · ${news.source_count || 1} fuentes · ${news.description || 'Lee el análisis completo en Contexto Claro'}`
    const ogImage = news.image || `${url.origin}/logo.png`
    const canonicalUrl = `${url.origin}${path}`

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(news.title)} — Contexto Claro</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <meta property="og:site_name" content="Contexto Claro" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="es_LA" />
  <meta property="article:section" content="${escapeHtml(news.category || '')}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@contextoclaro" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p>${escapeHtml(news.title)}</p>
  <p>${escapeHtml(description)}</p>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch {
    return
  }
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
