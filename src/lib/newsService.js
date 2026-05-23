import { supabase } from './supabase'

/**
 * Strips HTML tags and decodes common HTML entities from a string.
 */
function stripHtml(str) {
  if (!str) return str
  let clean = str
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;[^&]*&gt;/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // If after cleaning it's just a URL or Google News junk, return empty
  if (clean.startsWith('<a href') || clean.startsWith('http') && clean.split(' ').length <= 3) return ''
  return clean
}

/**
 * Transforma una row de Supabase al formato que esperan los componentes.
 */
function mapNewsRow(row) {
  return {
    id: row.id,
    title: stripHtml(row.title),
    description: stripHtml(row.description),
    category: row.category,
    country: row.country,
    countryCode: row.country_code,
    image: row.image,
    readTime: row.read_time,
    author: row.author,
    bias: { left: row.bias_left, center: row.bias_center, right: row.bias_right },
    biasLabel: row.bias_label,
    credibility: row.credibility,
    sourceCount: row.source_count,
    veracity: row.veracity,
    veracityDetail: row.veracity_detail,
    sponsoredFlag: row.sponsored_flag,
    // Blindspot
    side: row.blindspot_side,
    icon: row.blindspot_icon,
    severity: row.blindspot_severity,
    sourcesMissing: row.blindspot_sources_missing,
    detail: row.blindspot_detail,
    // Feed
    source: row.source_label,
    time: row.time_label,
    // Gemini validation
    geminiValidated: row.gemini_validated,
    geminiVerdict: row.gemini_verdict,
    geminiConfidence: row.gemini_confidence,
    geminiReasoning: row.gemini_reasoning,
    // Sources (si vienen con join)
    sources: row.news_sources
      ? row.news_sources
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(s => ({ name: s.name, bias: s.bias, stance: s.stance }))
      : undefined,
  }
}

const ALLOWED_COUNTRIES = ['VE', 'CO', 'TECH']

/**
 * Helper: aplica filtro de country_code a un query builder.
 * Siempre restringe a países permitidos (VE, CO).
 */
function applyCountryFilter(query, countryCode) {
  if (countryCode && countryCode !== 'ALL') {
    return query.eq('country_code', countryCode)
  }
  return query.in('country_code', ALLOWED_COUNTRIES)
}

/**
 * Fetch balanceado: cuando countryCode es 'ALL', trae mitad VE y mitad CO
 * (más TECH como bonus), luego intercala por fecha.
 * Cuando es un país específico, funciona normal.
 */
async function fetchBalanced(buildQuery, countryCode, limit) {
  if (countryCode && countryCode !== 'ALL') {
    const query = buildQuery(limit)
    const { data, error } = await query.eq('country_code', countryCode)
    if (error) throw error
    return data || []
  }

  const half = Math.ceil(limit / 2)
  const techLimit = Math.max(2, Math.floor(limit / 5))

  const [veResult, coResult, techResult] = await Promise.all([
    buildQuery(half).eq('country_code', 'VE'),
    buildQuery(half).eq('country_code', 'CO'),
    buildQuery(techLimit).eq('country_code', 'TECH'),
  ])

  if (veResult.error) throw veResult.error
  if (coResult.error) throw coResult.error

  const veData = veResult.data || []
  const coData = coResult.data || []
  const techData = techResult.data || []

  // Intercalar VE y CO alternando, luego agregar TECH
  const balanced = []
  const maxLen = Math.max(veData.length, coData.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < veData.length) balanced.push(veData[i])
    if (i < coData.length) balanced.push(coData[i])
  }
  balanced.push(...techData)

  return balanced.slice(0, limit)
}

/**
 * RPC consolidada: hero + daily + feed + stats en UNA sola query.
 * Reemplaza 4-12 round-trips al backend. Crítico para mobile.
 */
export async function fetchHomeFeed(countryCode = 'ALL') {
  const { data, error } = await supabase
    .rpc('get_home_feed', {
      p_country: countryCode || 'ALL',
      p_hero_limit: 4,
      p_daily_limit: 20,
      p_feed_limit: 30,
    })
  if (error) throw error
  if (!data) return null
  return {
    hero: (data.hero || []).map(mapNewsRow),
    daily: (data.daily || []).map(mapNewsRow),
    feed: (data.feed || []).map(mapNewsRow),
    stats: data.stats ? {
      total: Number(data.stats.total) || 0,
      verified: Number(data.stats.verified) || 0,
      misleading: Number(data.stats.misleading) || 0,
      fake: Number(data.stats.fake) || 0,
      sponsored: Number(data.stats.sponsored) || 0,
      biasLeft: Number(data.stats.bias_left) || 0,
      biasCenter: Number(data.stats.bias_center) || 0,
      biasRight: Number(data.stats.bias_right) || 0,
      aiValidated: Number(data.stats.ai_validated) || 0,
    } : null,
  }
}

/**
 * Obtiene las noticias hero (las 4 más recientes con imagen, 2 VE + 2 CO).
 * Sin join a news_sources — el modal carga las sources por separado.
 */
export async function fetchHeroNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .not('image', 'is', null)
    .not('image', 'like', '%googleusercontent%')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 4)
  return data.map(mapNewsRow)
}

/**
 * Obtiene las noticias del resumen diario.
 */
export async function fetchDailyNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .in('news_type', ['daily', 'feed'])
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 20)
  return data.map(mapNewsRow)
}

/**
 * Obtiene las noticias de puntos ciegos (blindspot).
 */
export async function fetchBlindspotNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .eq('news_type', 'blindspot')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 20)
  return data.map(mapNewsRow)
}

/**
 * Obtiene las noticias del feed en tiempo real.
 */
export async function fetchFeedNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .eq('news_type', 'feed')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 30)
  return data.map(mapNewsRow)
}

/**
 * Obtiene noticias detectadas como patrocinadas/propaganda.
 */
export async function fetchSponsoredNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .not('sponsored_flag', 'is', null)
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 20)
  return data.map(mapNewsRow)
}

/**
 * Obtiene noticias marcadas como falsas o engañosas por la IA.
 */
export async function fetchFlaggedNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*')
    .in('gemini_verdict', ['fake', 'misleading'])
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 20)
  return data.map(mapNewsRow)
}

/**
 * Obtiene noticias generales (uso en regional context).
 * Sin join — bajamos limit y eliminamos join pesado.
 */
export async function fetchAllNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('id, title, description, category, country, country_code, image, source_label, source_count, bias_left, bias_center, bias_right, bias_label, gemini_verdict, gemini_confidence, score_factual, score_source_div, score_transparency, score_independence, veracity, sponsored_flag, published_at')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 100)
  return data.map(mapNewsRow)
}

export async function fetchNewsByCategory(pattern, countryCode, limit = 12) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('id, title, description, category, country, country_code, image, source_label, source_count, bias_left, bias_center, bias_right, bias_label, gemini_verdict, gemini_confidence, score_factual, score_source_div, score_transparency, score_independence, veracity, sponsored_flag, published_at')
    .ilike('category', `%${pattern}%`)
    .order('published_at', { ascending: false })
    .limit(lim)

  try {
    const data = await fetchBalanced(buildQuery, countryCode, limit)
    return data.map(mapNewsRow)
  } catch {
    return []
  }
}

/**
 * Obtiene el detalle completo de un artículo (párrafos + fuentes + scores).
 */
export async function fetchArticleDetail(newsId) {
  const [newsResult, paragraphsResult] = await Promise.all([
    supabase
      .from('news')
      .select('*, news_sources(*)')
      .eq('id', newsId)
      .single(),
    supabase
      .from('article_paragraphs')
      .select('*')
      .eq('news_id', newsId)
      .order('sort_order', { ascending: true }),
  ])

  if (newsResult.error) throw newsResult.error
  if (paragraphsResult.error) throw paragraphsResult.error

  const row = newsResult.data
  // Construye el body como bloques heterogeneos para soportar tipografia
  // editorial estilo CNN / The Objective: heading, paragraph, image, video.
  //   { kind: 'heading', text }
  //   { kind: 'text',    text }
  //   { kind: 'image' | 'youtube' | 'video', url, caption, alt }
  const cleanBody = (paragraphsResult.data || []).flatMap(p => {
    const blocks = []
    const rawText = stripHtml(p.content || '').trim()
    const hasMedia = !!(p.media_url && p.media_type)

    if (rawText && rawText.length > 5 && !rawText.startsWith('http')) {
      let fixed = rawText
        .replace(/&nbsp;/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s{2,}/g, ' ')

      // Si este p\u00e1rrafo ya tiene media resuelto (vino del script de
      // backfill twitter), quitar el "pic.twitter.com/..." del texto
      // para no duplicar el embed visual.
      if (hasMedia) {
        fixed = fixed.replace(/\s*pic\.twitter\.com\/[A-Za-z0-9]+/g, '').trim()
        if (fixed.length < 5) fixed = '' // si qued\u00f3 solo el slug
      }

      // Detect editorial section headers: "EL CONTEXTO — texto..." → heading + text
      const headingMatch = fixed.match(/^([A-ZÁÉÍÓÚÑ ]{3,40})\s*[—–-]\s*(.+)$/)
      if (!fixed) {
        // texto eliminado por completo tras limpieza
      } else if (headingMatch) {
        blocks.push({ kind: 'heading', text: headingMatch[1].trim() })
        blocks.push({ kind: 'text', text: headingMatch[2].trim() })
      } else if (hasMedia) {
        blocks.push({ kind: 'text', text: fixed })
      } else {
        const sentences = fixed
          .replace(/\.([A-ZÁÉÍÓÚÑ¿¡])/g, '.\n$1')
          .replace(/\?([A-ZÁÉÍÓÚÑ¿¡])/g, '?\n$1')
          .replace(/!([A-ZÁÉÍÓÚÑ¿¡])/g, '!\n$1')
          .split('\n').map(s => s.trim()).filter(s => s.length > 15)
        sentences.forEach(t => blocks.push({ kind: 'text', text: t }))
      }
    }

    if (hasMedia) {
      blocks.push({
        kind: p.media_type,
        url: p.media_url,
        caption: p.media_caption || null,
        alt: p.media_alt || null,
      })
    }

    return blocks
  })
  return {
    news: mapNewsRow(row),
    body: cleanBody,
    sources: row.news_sources
      ? row.news_sources
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(s => ({
            name: s.name,
            bias: s.bias,
            credibility: s.credibility,
            stance: s.stance,
          }))
      : [],
    scores: {
      factual: row.score_factual,
      sourceDiv: row.score_source_div,
      transparency: row.score_transparency,
      independence: row.score_independence,
    },
  }
}

/**
 * Búsqueda full-text en español.
 */
export async function searchNews(query, maxResults = 20) {
  const { data, error } = await supabase
    .rpc('search_news', { search_query: query, max_results: maxResults })

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Estadísticas en tiempo real del sitio.
 * Usa RPC get_site_stats — una sola query con COUNT FILTER en Postgres.
 * Antes cargaba toda la tabla y contaba en JS (causaba statement_timeout).
 */
export async function fetchSiteStats(countryCode) {
  const { data, error } = await supabase
    .rpc('get_site_stats', { country_filter: countryCode || 'ALL' })

  if (error || !data || data.length === 0) return null

  const row = data[0]
  return {
    total: Number(row.total) || 0,
    verified: Number(row.verified) || 0,
    misleading: Number(row.misleading) || 0,
    fake: Number(row.fake) || 0,
    sponsored: Number(row.sponsored) || 0,
    biasLeft: Number(row.bias_left) || 0,
    biasCenter: Number(row.bias_center) || 0,
    biasRight: Number(row.bias_right) || 0,
    aiValidated: Number(row.ai_validated) || 0,
  }
}

/**
 * Trae los posts del feed político social (Mastodon + Google News RSS).
 * Refresh por cron cada 30min vía edge function refresh-political-feed.
 */
export async function fetchPoliticalFeed(countryCode = 'ALL', limit = 30) {
  let query = supabase
    .from('political_tweets')
    .select('id, source, source_name, title, text, url, author_name, country_code, tweet_created_at, media')
    .order('tweet_created_at', { ascending: false })
    .limit(limit)
  if (countryCode && countryCode !== 'ALL') {
    query = query.eq('country_code', countryCode)
  } else {
    query = query.in('country_code', ['VE', 'CO'])
  }
  const { data, error } = await query
  if (error || !data) return []
  return data
}
