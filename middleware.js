const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw'

const BOT_AGENTS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'googlebot', 'bingbot',
  'yandexbot', 'duckduckbot', 'applebot', 'pinterestbot',
  'redditbot', 'rogerbot', 'embedly', 'quora', 'outbrain',
  'vkshare', 'tumblr', 'w3c_validator', 'mediapartners-google',
  'adsbot-google', 'google-adwords', 'google-publisher',
]

export const config = {
  matcher: ['/', '/noticia/:path*'],
}

function slugify(text) {
  return (text || 'articulo')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export default async function middleware(req) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  const isBot = BOT_AGENTS.some(bot => ua.includes(bot))

  if (!isBot) return

  const url = new URL(req.url)
  const path = url.pathname

  if (path === '/') {
    return await renderHome(url)
  }

  const idMatch = path.match(/-(\d+)$/)
  if (!idMatch) return

  return await renderArticle(url, idMatch[1])
}

async function renderHome(url) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news?select=id,title,description,image,category,country,country_code,gemini_verdict,gemini_confidence,source_count,published_at,bias_label&country_code=in.(VE,CO,TECH)&order=published_at.desc&limit=30`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const articles = await res.json()
    if (!Array.isArray(articles) || !articles.length) return

    const verdictEmojis = { real: '✅', misleading: '⚠️', fake: '🚫', unverified: '❓' }
    const verdictLabels = { real: 'Verificada', misleading: 'Engañosa', fake: 'Falsa', unverified: 'Sin verificar' }

    const articleItems = articles.map((a) => {
      const link = `${url.origin}/noticia/${slugify(a.title)}-${a.id}`
      const vEmoji = verdictEmojis[a.gemini_verdict] || '❓'
      const vLabel = verdictLabels[a.gemini_verdict] || 'Sin verificar'
      const countryFlag = a.country_code === 'VE' ? '🇻🇪' : a.country_code === 'CO' ? '🇨🇴' : '💻'
      return `    <article>
      <h2><a href="${link}">${escapeHtml(a.title)}</a></h2>
      <p><small>${countryFlag} ${escapeHtml(a.category || '')} · ${vEmoji} ${vLabel} · ${a.source_count || 1} fuentes · ${escapeHtml(a.bias_label || '')}</small></p>
      ${a.description ? `<p>${escapeHtml(a.description).slice(0, 280)}${a.description.length > 280 ? '…' : ''}</p>` : ''}
      <p><small>Publicado: ${new Date(a.published_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })} · <a href="${link}">Leer análisis completo →</a></small></p>
    </article>`
    }).join('\n')

    const orgLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsMediaOrganization',
      'name': 'Contexto Claro',
      'url': url.origin,
      'logo': { '@type': 'ImageObject', 'url': `${url.origin}/logo.png` },
      'description': 'Medio independiente de verificación de noticias de Venezuela, Colombia y tecnología mundial mediante inteligencia artificial.',
      'sameAs': [
        'https://twitter.com/contextoclaro',
        'https://instagram.com/contextoclaro',
      ],
    }

    const itemListLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'itemListElement': articles.slice(0, 10).map((a, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'url': `${url.origin}/noticia/${slugify(a.title)}-${a.id}`,
        'name': a.title,
      })),
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Contexto Claro — Noticias verificadas de Venezuela, Colombia y tecnología</title>
  <meta name="description" content="Filtramos el ruido. Entregamos la verdad. Noticias de Venezuela, Colombia y tecnología mundial verificadas por IA. Detectamos fake news, sesgo político y contenido patrocinado con metodología transparente." />
  <meta name="keywords" content="noticias Venezuela, noticias Colombia, verificación noticias, fake news, fact-checking, sesgo mediático, desinformación, Contexto Claro, noticias LATAM" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${url.origin}/" />
  <link rel="alternate" type="application/rss+xml" title="Contexto Claro RSS" href="${url.origin}/rss.xml" />

  <meta property="og:site_name" content="Contexto Claro" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Contexto Claro — Filtramos el ruido. Entregamos la verdad." />
  <meta property="og:description" content="Noticias de Venezuela, Colombia y tecnología mundial verificadas por IA." />
  <meta property="og:url" content="${url.origin}/" />
  <meta property="og:image" content="${url.origin}/logo.png" />
  <meta property="og:locale" content="es_LA" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@contextoclaro" />
  <meta name="twitter:title" content="Contexto Claro — Noticias verificadas por IA" />
  <meta name="twitter:description" content="Noticias de Venezuela, Colombia y tecnología mundial verificadas por IA." />
  <meta name="twitter:image" content="${url.origin}/logo.png" />

  <script type="application/ld+json">${JSON.stringify(orgLd)}</script>
  <script type="application/ld+json">${JSON.stringify(itemListLd)}</script>

  <meta http-equiv="refresh" content="0;url=${url.origin}/" />
</head>
<body>
  <header>
    <h1>Contexto Claro</h1>
    <p><em>Filtramos el ruido. Entregamos la verdad.</em></p>
    <p>Somos un medio independiente que verifica noticias de Venezuela, Colombia y tecnología mundial mediante inteligencia artificial. Cada noticia pasa por un pipeline de análisis documentado que evalúa veracidad, sesgo político, diversidad de fuentes e independencia editorial. Conocé cómo lo hacemos en nuestra <a href="${url.origin}/methodology.html">metodología editorial</a>.</p>
  </header>

  <nav aria-label="Navegación principal">
    <ul>
      <li><a href="${url.origin}/about.html">Nosotros</a></li>
      <li><a href="${url.origin}/methodology.html">Metodología</a></li>
      <li><a href="${url.origin}/contact.html">Contacto</a></li>
      <li><a href="${url.origin}/terms.html">Términos</a></li>
      <li><a href="${url.origin}/privacy.html">Privacidad</a></li>
      <li><a href="${url.origin}/rss.xml">RSS</a></li>
    </ul>
  </nav>

  <section>
    <h2>Últimas noticias verificadas</h2>
${articleItems}
  </section>

  <footer>
    <p>&copy; 2026 Contexto Claro — Noticias verificadas por IA. <a href="${url.origin}/about.html">Sobre nosotros</a> · <a href="${url.origin}/methodology.html">Metodología</a> · <a href="${url.origin}/privacy.html">Privacidad</a> · <a href="${url.origin}/terms.html">Términos</a> · <a href="${url.origin}/contact.html">Contacto</a></p>
  </footer>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
      },
    })
  } catch {
    return
  }
}

async function renderArticle(url, newsId) {
  try {
    const [newsRes, paragraphsRes, sourcesRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/news?id=eq.${newsId}&select=id,title,description,image,category,country,country_code,gemini_verdict,gemini_confidence,gemini_reasoning,score_factual,score_source_div,score_transparency,score_independence,source_count,author,read_time,published_at,bias_label`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/article_paragraphs?news_id=eq.${newsId}&select=content,sort_order&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/news_sources?news_id=eq.${newsId}&select=name,bias,credibility,stance&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ),
    ])

    const [newsData, paragraphs, sources] = await Promise.all([
      newsRes.json(), paragraphsRes.json(), sourcesRes.json(),
    ])
    const news = newsData?.[0]
    if (!news) return

    const path = url.pathname

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
    const publishedAt = news.published_at || new Date().toISOString()

    const bodyParagraphs = (paragraphs || [])
      .map(p => `    <p>${escapeHtml(p.content || '')}</p>`)
      .join('\n')

    const sourcesList = (sources || []).length
      ? `  <section>
    <h2>Fuentes consultadas (${sources.length})</h2>
    <ul>
${sources.map(s => `      <li><strong>${escapeHtml(s.name || '')}</strong>${s.bias ? ` — sesgo: ${escapeHtml(s.bias)}` : ''}${s.credibility ? ` · credibilidad: ${s.credibility}/100` : ''}${s.stance ? `<br><em>${escapeHtml(s.stance)}</em>` : ''}</li>`).join('\n')}
    </ul>
  </section>`
      : ''

    const aiBlock = news.gemini_reasoning
      ? `  <section>
    <h2>Análisis de verificación por IA</h2>
    <p><strong>Veredicto:</strong> ${vEmoji} ${vLabel} — confianza ${news.gemini_confidence || 0}%.</p>
    <p>${escapeHtml(news.gemini_reasoning)}</p>
  </section>`
      : ''

    const countryName = news.country_code === 'VE' ? 'Venezuela' : news.country_code === 'CO' ? 'Colombia' : 'Tecnología'

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      'headline': news.title,
      'description': news.description || '',
      'image': [ogImage],
      'datePublished': publishedAt,
      'dateModified': publishedAt,
      'author': { '@type': 'Organization', 'name': news.author || 'Contexto Claro' },
      'publisher': {
        '@type': 'NewsMediaOrganization',
        'name': 'Contexto Claro',
        'logo': { '@type': 'ImageObject', 'url': `${url.origin}/logo.png` },
      },
      'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalUrl },
      'articleSection': news.category || '',
      'inLanguage': 'es-LA',
      'about': countryName,
    }

    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': url.origin },
        { '@type': 'ListItem', 'position': 2, 'name': countryName, 'item': `${url.origin}/?country=${news.country_code || 'ALL'}` },
        { '@type': 'ListItem', 'position': 3, 'name': news.title, 'item': canonicalUrl },
      ],
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(news.title)} — Contexto Claro</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml((news.category || '').toLowerCase())}, ${escapeHtml(countryName.toLowerCase())}, fact-checking, verificación noticias, Contexto Claro" />
  <meta name="author" content="${escapeHtml(news.author || 'Contexto Claro')}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
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
  <meta property="article:published_time" content="${publishedAt}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@contextoclaro" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>

  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <nav aria-label="Ruta de navegación">
    <a href="${url.origin}">Inicio</a> &rsaquo;
    <a href="${url.origin}/?country=${news.country_code || 'ALL'}">${countryName}</a> &rsaquo;
    <span>${escapeHtml(news.category || '')}</span>
  </nav>

  <article>
    <header>
      <h1>${escapeHtml(news.title)}</h1>
      <p><em>${vEmoji} ${vLabel} · Confianza ${news.gemini_confidence || 0}% · Puntuación global ${score}/100 · ${news.source_count || 1} fuentes · ${news.bias_label || 'Sin clasificar'}</em></p>
      <p><small>Publicado: ${new Date(publishedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}${news.read_time ? ' · ' + escapeHtml(news.read_time) : ''}</small></p>
    </header>

    ${news.description ? `<p><strong>${escapeHtml(news.description)}</strong></p>` : ''}

${bodyParagraphs}

${aiBlock}

${sourcesList}

    <footer>
      <p><small>Esta noticia fue verificada por el pipeline de IA de Contexto Claro. Conoce nuestra <a href="${url.origin}/methodology.html">metodología editorial</a>.</small></p>
    </footer>
  </article>
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
