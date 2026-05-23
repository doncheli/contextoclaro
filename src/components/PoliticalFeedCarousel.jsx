import { useState, useEffect, useRef } from 'react'
import { Radio, ChevronLeft, ChevronRight, ExternalLink, Share2 } from 'lucide-react'
import { fetchPoliticalFeed } from '../lib/newsService'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function flagFor(country) {
  if (country === 'VE') return '🇻🇪'
  if (country === 'CO') return '🇨🇴'
  return '🌎'
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`
  } catch {
    return null
  }
}

function imageOf(item) {
  const m = Array.isArray(item.media) ? item.media[0]?.url : null
  if (m) return { src: m, isFavicon: false }
  const fav = faviconFor(item.url)
  return fav ? { src: fav, isFavicon: true } : null
}

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

function FeedCard({ item }) {
  const [copied, setCopied] = useState(false)
  const isMastodon = item.source === 'mastodon'
  const display = item.title || item.text || ''
  const cleanText = display.length > 160 ? display.slice(0, 160).trim() + '…' : display
  const sourceLabel = item.source_name || (isMastodon ? 'Mastodon' : 'Google News')
  const img = imageOf(item)

  const onShare = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const shareData = { title: sourceLabel, text: display.slice(0, 200), url: item.url }
    if (isMobile && navigator.share) {
      try { await navigator.share(shareData) } catch { /* user canceled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(item.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(display.slice(0, 200))}&url=${encodeURIComponent(item.url)}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="snap-start shrink-0 w-[300px] md:w-[340px] card overflow-hidden hover:border-accent/40 transition-colors group flex flex-col">
      {img && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="relative block bg-surface/40 overflow-hidden" style={{ aspectRatio: img.isFavicon ? '16/9' : '16/9' }}>
          <img
            src={img.src}
            alt={sourceLabel}
            loading="lazy"
            className={img.isFavicon
              ? 'absolute inset-0 m-auto w-12 h-12 object-contain opacity-80'
              : 'w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500'}
            onError={(e) => {
              const fav = faviconFor(item.url)
              if (fav && e.currentTarget.src !== fav) {
                e.currentTarget.src = fav
                e.currentTarget.className = 'absolute inset-0 m-auto w-12 h-12 object-contain opacity-80'
              } else {
                e.currentTarget.style.display = 'none'
              }
            }}
          />
          <span className={`absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            isMastodon ? 'bg-purple-600/90 text-white' : 'bg-blue-600/90 text-white'
          }`}>
            {isMastodon ? 'Mastodon' : 'News'}
          </span>
        </a>
      )}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{flagFor(item.country_code)}</span>
          <span className="text-[10px] text-text-muted truncate flex-1">{sourceLabel}</span>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Abrir fuente">
            <ExternalLink size={12} className="text-text-muted hover:text-accent transition-colors" />
          </a>
        </div>
        <p className="text-sm leading-snug text-text-primary line-clamp-4 min-h-[4rem]">
          {cleanText}
        </p>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
          <span className="text-[10px] text-text-muted">{timeAgo(item.tweet_created_at)}</span>
          <button
            onClick={onShare}
            aria-label="Compartir"
            title={copied ? '¡Copiado!' : 'Compartir'}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent transition-colors px-1.5 py-1 -mr-1 rounded"
          >
            <Share2 size={12} />
            <span>{copied ? 'Copiado' : 'Compartir'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PoliticalFeedCarousel({ countryCode = 'ALL' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const scrollerRef = useRef(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchPoliticalFeed(countryCode, 30)
      .then((data) => { if (mounted) setItems(data || []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [countryCode])

  const scroll = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={16} className="text-accent animate-pulse" />
          <h2 className="text-lg font-bold">Pulso político en redes</h2>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card w-[300px] h-[300px] shrink-0 animate-pulse bg-surface/50" />
          ))}
        </div>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Radio size={16} className="text-accent" />
        <h2 className="text-lg font-bold flex-1">Pulso político en redes</h2>
        <span className="text-[10px] text-text-muted hidden sm:inline">
          Mastodon · Google News RSS
        </span>
        <div className="hidden md:flex gap-1">
          <button
            onClick={() => scroll('left')}
            aria-label="Anterior"
            className="p-1.5 rounded-full hover:bg-surface transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Siguiente"
            className="p-1.5 rounded-full hover:bg-surface transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item) => (
          <FeedCard key={`${item.source}_${item.id}`} item={item} />
        ))}
      </div>
    </section>
  )
}
