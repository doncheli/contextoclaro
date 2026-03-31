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
 * Obtiene las noticias hero (las 3 más recientes con imagen).
 */
export async function fetchHeroNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*, news_sources(*)')
    .not('image', 'is', null)
    .not('image', 'like', '%googleusercontent%')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 3)
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
 * Obtiene TODAS las noticias (para el detalle).
 */
export async function fetchAllNews(countryCode) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*, news_sources(*)')
    .order('published_at', { ascending: false })
    .limit(lim)

  const data = await fetchBalanced(buildQuery, countryCode, 200)
  return data.map(mapNewsRow)
}

export async function fetchNewsByCategory(pattern, countryCode, limit = 12) {
  const buildQuery = (lim) => supabase
    .from('news')
    .select('*, news_sources(*)')
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
  // Clean and split paragraphs properly
  const cleanBody = paragraphsResult.data
    .map(p => stripHtml(p.content))
    .filter(text => text && text.length > 20 && !text.startsWith('http'))
    .flatMap(text => {
      // Split long concatenated blocks into proper paragraphs
      // Detect sentences that end with period+capital letter without space
      const fixed = text
        .replace(/&nbsp;/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\.([A-ZÁÉÍÓÚÑ¿¡])/g, '.\n$1')
        .replace(/\?([A-ZÁÉÍÓÚÑ¿¡])/g, '?\n$1')
        .replace(/!([A-ZÁÉÍÓÚÑ¿¡])/g, '!\n$1')
        .replace(/\s{2,}/g, ' ')
      return fixed.split('\n').map(s => s.trim()).filter(s => s.length > 15)
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
 */
export async function fetchSiteStats(countryCode) {
  let query = supabase.from('news').select('gemini_verdict, bias_label, sponsored_flag, gemini_validated', { count: 'exact', head: false })
  query = applyCountryFilter(query, countryCode)
  const { data, error } = await query
  if (error) return null

  const rows = data || []
  return {
    total: rows.length,
    verified: rows.filter(r => r.gemini_verdict === 'real').length,
    misleading: rows.filter(r => r.gemini_verdict === 'misleading').length,
    fake: rows.filter(r => r.gemini_verdict === 'fake').length,
    sponsored: rows.filter(r => r.sponsored_flag).length,
    biasLeft: rows.filter(r => r.bias_label === 'IZQUIERDA').length,
    biasCenter: rows.filter(r => r.bias_label === 'CENTRO' || r.bias_label === 'EQUILIBRADO').length,
    biasRight: rows.filter(r => r.bias_label === 'DERECHA').length,
    aiValidated: rows.filter(r => r.gemini_validated).length,
  }
}
