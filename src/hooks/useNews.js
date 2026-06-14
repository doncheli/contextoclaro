import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchBlindspotNews,
  fetchFlaggedNews,
  fetchSponsoredNews,
  fetchAllNews,
  fetchNewsByCategory,
  fetchArticleDetail,
  searchNews,
  fetchHomeFeed,
  fetchNewsPage,
} from '../lib/newsService'

// localStorage cache: muestra el contenido viejo de inmediato (UX) pero
// SIEMPRE refresca en background. TTL solo controla cuándo se considera
// "demasiado viejo para ni mostrarlo". 5 min es buen balance: el edge
// CDN sirve 30s fresh; cliente garantiza nunca >5 min sin refresh.
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_PREFIX = 'cc_cache_v3_'

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
    catInvestigacion: [],
  })
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const loadCritical = useCallback(async () => {
    // Una sola RPC reemplaza 4-12 round-trips. Crítico en mobile.
    const data = await fetchHomeFeed(countryCode)
    if (!mountedRef.current || !data) return null
    const hero = data.hero || []
    const daily = data.daily || []
    const feed = data.feed || []
    const heroSlides = hero.length > 0 ? hero : daily.slice(0, 3).concat(feed.slice(0, 3)).slice(0, 3)
    return { hero: heroSlides, daily, feed, stats: data.stats }
  }, [countryCode])

  const loadDeferred = useCallback(async () => {
    const [blindspot, flagged, sponsored, allNews, catPolitica, catEconomia, catDeportes, catTecnologia, catInvestigacion] = await Promise.all([
      fetchBlindspotNews(countryCode),
      fetchFlaggedNews(countryCode),
      fetchSponsoredNews(countryCode),
      fetchAllNews(countryCode),
      fetchNewsByCategory('olític', countryCode),
      fetchNewsByCategory('conomí', countryCode),
      fetchNewsByCategory('eporte', countryCode),
      fetchNewsByCategory('ecnolog', countryCode),
      fetchNewsByCategory('investigaci', countryCode, 50),
    ])
    if (!mountedRef.current) return null
    return { blindspot, flagged, sponsored, allNews, catPolitica, catEconomia, catDeportes, catTecnologia, catInvestigacion }
  }, [countryCode])

  useEffect(() => {
    mountedRef.current = true
    let intervalId = null

    // Stale-while-revalidate: si hay cache, mostrarlo de inmediato y refrescar en background.
    // Si la red falla, mantener cache visible en lugar de mostrar error.
    const hasUsableCache = cached && (cached.hero || cached.daily?.length)

    // Wrapper con hard timeout — si la query del cliente excede N ms, abandonamos
    // y caemos a cache. Evita que un timeout del servidor (Postgres) bloquee la UI.
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`client_timeout_${ms}ms`)), ms)),
    ])

    ;(async () => {
      try {
        if (!hasUsableCache) setLoading(true)

        // Retry con backoff exponencial — 3 intentos, cada uno con hard timeout 5s
        let critical = null
        let lastErr = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            critical = await withTimeout(loadCritical(), 5000)
            break
          } catch (e) {
            lastErr = e
            if (attempt < 2) await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt)))
          }
        }

        if (!mountedRef.current) return

        if (critical) {
          setSections(prev => ({ ...prev, ...critical }))
          setError(null)
          setLoading(false)
        } else if (hasUsableCache) {
          // No bloqueamos: ya tenemos cache visible, fallaste en silencio
          console.warn('[useNews] critical fetch failed, manteniendo cache', lastErr)
          setLoading(false)
        } else {
          setError(lastErr?.message || 'Error al cargar noticias')
          setLoading(false)
          return
        }

        // Fase 2 — no bloqueante. Si falla, el sitio sigue funcionando con la fase 1.
        try {
          const deferred = await loadDeferred()
          if (!mountedRef.current || !deferred) return
          setSections(prev => {
            const merged = { ...prev, ...deferred }
            writeCache(cacheKey, merged)
            return merged
          })
        } catch (e) {
          console.warn('[useNews] deferred fetch falló (no crítico):', e?.message)
        }
      } catch (err) {
        if (mountedRef.current) {
          if (!hasUsableCache) setError(err.message || 'Error al cargar noticias')
          setLoading(false)
        }
      }
    })()

    intervalId = setInterval(async () => {
      try {
        const fresh = await fetchHomeFeed(countryCode)
        if (mountedRef.current && fresh?.stats) {
          setSections(prev => ({ ...prev, stats: fresh.stats }))
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
 * Paginación bajo demanda para la vista "Todas las Noticias".
 * Carga la primera página al activarse y trae las siguientes al pulsar "Cargar más".
 * Ordena por fecha de carga (published_at) y no carga nada de forma eager mientras
 * el usuario esté en la home — evita traer miles de filas de golpe.
 */
export function usePaginatedNews(countryCode = 'ALL', active = false, pageSize = 48) {
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const mountedRef = useRef(true)
  const loadingRef = useRef(false)

  // Reset cuando cambia el país.
  useEffect(() => { setItems([]); setHasMore(true) }, [countryCode])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const offset = items.length
      const rows = await fetchNewsPage(countryCode, offset, pageSize)
      if (!mountedRef.current) return
      setItems(prev => [...prev, ...rows])
      setHasMore(rows.length === pageSize)
    } catch { /* mantener lo cargado */ } finally {
      loadingRef.current = false
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [countryCode, items.length, pageSize, hasMore])

  // Auto-carga de la primera página al activar la vista.
  useEffect(() => {
    if (active && items.length === 0 && hasMore && !loadingRef.current) loadMore()
  }, [active, items.length, hasMore, loadMore])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  return { items, hasMore, loadingMore, loadMore }
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
