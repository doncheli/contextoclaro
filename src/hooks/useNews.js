import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchHeroNews,
  fetchDailyNews,
  fetchBlindspotNews,
  fetchFeedNews,
  fetchFlaggedNews,
  fetchSponsoredNews,
  fetchAllNews,
  fetchNewsByCategory,
  fetchArticleDetail,
  searchNews,
  fetchSiteStats,
} from '../lib/newsService'

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_PREFIX = 'cc_cache_v1_'

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return data
  } catch { return null }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* quota or private mode */ }
}

/**
 * Carga progresiva en dos fases:
 *   Fase 1 (bloquea spinner): hero, daily, feed, stats — ~400-800ms
 *   Fase 2 (background, no bloquea): blindspot, flagged, sponsored, allNews, categorías
 *
 * Cache localStorage TTL 5min hace el segundo paint instantáneo.
 */
export function useNewsSections(countryCode = 'ALL') {
  const cacheKey = `sections_${countryCode}`
  const cached = typeof window !== 'undefined' ? readCache(cacheKey) : null

  const [sections, setSections] = useState(cached || {
    hero: null,
    daily: [],
    blindspot: [],
    feed: [],
    flagged: [],
    sponsored: [],
    allNews: [],
    stats: null,
    catPolitica: [],
    catEconomia: [],
    catDeportes: [],
    catTecnologia: [],
  })
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const loadCritical = useCallback(async () => {
    const [hero, daily, feed, stats] = await Promise.all([
      fetchHeroNews(countryCode),
      fetchDailyNews(countryCode),
      fetchFeedNews(countryCode),
      fetchSiteStats(countryCode),
    ])
    if (!mountedRef.current) return null
    const heroSlides = hero.length > 0 ? hero : daily.slice(0, 3).concat(feed.slice(0, 3)).slice(0, 3)
    return { hero: heroSlides, daily, feed, stats }
  }, [countryCode])

  const loadDeferred = useCallback(async () => {
    const [blindspot, flagged, sponsored, allNews, catPolitica, catEconomia, catDeportes, catTecnologia] = await Promise.all([
      fetchBlindspotNews(countryCode),
      fetchFlaggedNews(countryCode),
      fetchSponsoredNews(countryCode),
      fetchAllNews(countryCode),
      fetchNewsByCategory('olític', countryCode),
      fetchNewsByCategory('conomí', countryCode),
      fetchNewsByCategory('eporte', countryCode),
      fetchNewsByCategory('ecnolog', countryCode),
    ])
    if (!mountedRef.current) return null
    return { blindspot, flagged, sponsored, allNews, catPolitica, catEconomia, catDeportes, catTecnologia }
  }, [countryCode])

  useEffect(() => {
    mountedRef.current = true
    let intervalId = null

    ;(async () => {
      try {
        if (!cached) setLoading(true)

        const critical = await loadCritical()
        if (!mountedRef.current || !critical) return
        setSections(prev => ({ ...prev, ...critical }))
        setError(null)
        setLoading(false)

        const deferred = await loadDeferred()
        if (!mountedRef.current || !deferred) return
        setSections(prev => {
          const merged = { ...prev, ...deferred }
          writeCache(cacheKey, merged)
          return merged
        })
      } catch (err) {
        if (mountedRef.current) {
          setError(err.message || 'Error al cargar noticias')
          setLoading(false)
        }
      }
    })()

    intervalId = setInterval(async () => {
      try {
        const freshStats = await fetchSiteStats(countryCode)
        if (mountedRef.current && freshStats) {
          setSections(prev => ({ ...prev, stats: freshStats }))
        }
      } catch { /* silent */ }
    }, 5 * 60 * 1000)

    return () => { mountedRef.current = false; if (intervalId) clearInterval(intervalId) }
  }, [countryCode, cacheKey, loadCritical, loadDeferred])

  return { ...sections, loading, error }
}

/**
 * Carga el detalle de un artículo bajo demanda.
 */
export function useArticleDetail(newsId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    if (!newsId) {
      setData(null)
      setLoading(false)
      return
    }
    try {
      const result = await fetchArticleDetail(newsId)
      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Error al cargar artículo')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [newsId])

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    load()
    return () => { mountedRef.current = false }
  }, [load])

  return { data, loading, error }
}

/**
 * Hook de búsqueda con debounce.
 */
export function useNewsSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchNews(query)
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { query, setQuery, results, searching }
}
