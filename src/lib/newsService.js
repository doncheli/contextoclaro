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

const ALLOWED_COUNTRIES = ['VE', 'CO']

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
 * Obtiene las noticias hero (las 3 más recientes con imagen).
 */
export async function fetchHeroNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*, news_sources(*)')
    .not('image', 'is', null)
    .not('image', 'like', '%googleusercontent%')
    .order('published_at', { ascending: false })
    .limit(3)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return (data || []).map(mapNewsRow)
}

/**
 * Obtiene las noticias del resumen diario.
 */
export async function fetchDailyNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*')
    .in('news_type', ['daily', 'feed'])
    .order('published_at', { ascending: false })
    .limit(20)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Obtiene las noticias de puntos ciegos (blindspot).
 */
export async function fetchBlindspotNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*')
    .eq('news_type', 'blindspot')
    .order('published_at', { ascending: false })

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Obtiene las noticias del feed en tiempo real.
 */
export async function fetchFeedNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*')
    .eq('news_type', 'feed')
    .order('published_at', { ascending: false })
    .limit(30)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Obtiene noticias detectadas como patrocinadas/propaganda.
 */
export async function fetchSponsoredNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*')
    .not('sponsored_flag', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Obtiene noticias marcadas como falsas o engañosas por la IA.
 */
export async function fetchFlaggedNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*')
    .in('gemini_verdict', ['fake', 'misleading'])
    .order('published_at', { ascending: false })
    .limit(20)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
}

/**
 * Obtiene TODAS las noticias (para el detalle).
 */
export async function fetchAllNews(countryCode) {
  let query = supabase
    .from('news')
    .select('*, news_sources(*)')
    .order('published_at', { ascending: false })
    .limit(100)

  query = applyCountryFilter(query, countryCode)

  const { data, error } = await query

  if (error) throw error
  return data.map(mapNewsRow)
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
  // Filter out HTML junk paragraphs (Google News RSS artifacts)
  const cleanBody = paragraphsResult.data
    .map(p => p.content)
    .filter(text => !text.includes('<a href') && !text.includes('&lt;a href') && text.length > 20)
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
