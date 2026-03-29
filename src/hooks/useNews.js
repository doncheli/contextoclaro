import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchHeroNews,
  fetchDailyNews,
  fetchBlindspotNews,
  fetchFeedNews,
  fetchFlaggedNews,
  fetchSponsoredNews,
  fetchAllNews,
  fetchArticleDetail,
  searchNews,
  fetchSiteStats,
} from '../lib/newsService'

/**
 * Carga todas las secciones de noticias en paralelo.
 * Acepta countryCode para filtrar por país.
 */
export function useNewsSections(countryCode = 'ALL') {
  const [sections, setSections] = useState({
    hero: null,
    daily: [],
    blindspot: [],
    feed: [],
    flagged: [],
    sponsored: [],
    allNews: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const loadData = useCallback(async () => {
    try {
      const [hero, daily, blindspot, feed, flagged, sponsored, allNews, stats] = await Promise.all([
        fetchHeroNews(countryCode),
        fetchDailyNews(countryCode),
        fetchBlindspotNews(countryCode),
        fetchFeedNews(countryCode),
        fetchFlaggedNews(countryCode),
        fetchSponsoredNews(countryCode),
        fetchAllNews(countryCode),
        fetchSiteStats(countryCode),
      ])

      if (!mountedRef.current) return

      const heroSlides = hero.length > 0 ? hero : daily.slice(0, 3).concat(feed.slice(0, 3)).slice(0, 3)

      setSections({
        hero: heroSlides,
        daily,
        blindspot,
        feed,
        flagged,
        sponsored,
        allNews,
        stats,
      })
      setError(null)
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Error al cargar noticias')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [countryCode])

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    loadData()
    return () => { mountedRef.current = false }
  }, [loadData])

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
