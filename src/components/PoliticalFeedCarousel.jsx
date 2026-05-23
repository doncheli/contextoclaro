import { useState, useEffect, useRef } from 'react'
import { Radio, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
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

function FeedCard({ item }) {
  const isMastodon = item.source === 'mastodon'
  const isGnews = item.source === 'gnews'
  const display = item.title || item.text || ''
  const cleanText = display.length > 180 ? display.slice(0, 180).trim() + '…' : display
  const sourceLabel = item.source_name || (isMastodon ? 'Mastodon' : 'Google News')

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="snap-start shrink-0 w-[300px] md:w-[340px] card p-4 hover:border-accent/40 transition-colors group flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{flagFor(item.country_code)}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
          isMastodon ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {isMastodon ? 'Mastodon' : 'News'}
        </span>
        <span className="text-[10px] text-text-muted truncate flex-1">{sourceLabel}</span>
        <ExternalLink size={12} className="text-text-muted shrink-0" />
      </div>
      <p className="text-sm leading-snug text-text-primary group-hover:text-accent-light transition-colors line-clamp-5 min-h-[5rem]">
        {cleanText}
      </p>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
        <span className="text-[10px] text-text-muted">{timeAgo(item.tweet_created_at)}</span>
        {item.author_name && (
          <span className="text-[10px] text-text-muted truncate max-w-[140px]">
            {item.author_name}
          </span>
        )}
      </div>
    </a>
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
            <div key={i} className="card p-4 w-[300px] h-[180px] shrink-0 animate-pulse bg-surface/50" />
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
