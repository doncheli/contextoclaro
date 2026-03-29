import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Eye, CheckCircle, AlertOctagon,
  ChevronRight, User as UserIcon, ChevronDown,
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Menu, X, TrendingUp, BarChart3, Compass, Newspaper, AlertTriangle, DollarSign, Megaphone,
  Share2, Clock, ExternalLink, Copy, MessageCircle, Flame
} from 'lucide-react'
import ArticleView from './NewsDetailModal'
import { useNewsSections, useNewsSearch } from './hooks/useNews'
import { searchNews } from './lib/newsService'
import AdBanner from './components/AdBanner'
import {
  trackCountryFilter, trackSearch, trackSectionView,
  trackFakeNewsAlertView, trackSponsoredAlertView, trackAdImpression, trackShareClick
} from './lib/analytics'
import { getFallbackImage } from './lib/categoryImages'

/* ═══════════════ HELPERS ═══════════════ */

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

function buildArticlePath(id, title) {
  return `/noticia/${slugify(title || 'articulo')}-${id}`
}

function parseArticleIdFromPath() {
  // Support new format: /noticia/slug-123
  const match = window.location.pathname.match(/\/noticia\/.*-(\d+)$/)
  if (match) return Number(match[1])
  // Fallback: ?article=123
  const params = new URLSearchParams(window.location.search)
  const id = params.get('article')
  return id ? Number(id) : null
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function readTime(news) {
  const words = (news.description || '').split(' ').length + (news.sourceCount || 1) * 50
  const mins = Math.max(1, Math.round(words / 200))
  return `${mins} min`
}

function reliabilityLabel(score) {
  if (score >= 8) return { label: 'Muy fiable', color: 'bg-success text-white' }
  if (score >= 6) return { label: 'Fiable', color: 'bg-accent text-white' }
  if (score >= 4) return { label: 'Precaución', color: 'bg-warning text-white' }
  return { label: 'No fiable', color: 'bg-danger text-white' }
}

const CATEGORIES = [
  { key: 'ALL', label: 'Todas' },
  { key: 'POLÍTICA', label: 'Política' },
  { key: 'ECONOMÍA', label: 'Economía' },
  { key: 'SEGURIDAD', label: 'Seguridad' },
  { key: 'DEPORTES', label: 'Deportes' },
  { key: 'TECNOLOGÍA', label: 'Tecnología' },
  { key: 'SALUD', label: 'Salud' },
  { key: 'DESINFORMACIÓN', label: 'Fake News' },
]

const COUNTRIES = [
  { code: 'ALL', name: 'Todos los países', emoji: '🌎' },
  { code: 'VE', name: 'Venezuela', emoji: '🇻🇪' },
  { code: 'CO', name: 'Colombia', emoji: '🇨🇴' },
]

/* ═══════════════ BREAKING NEWS BANNER ═══════════════ */

function BreakingNewsBanner({ flagged, onSelectNews }) {
  const breaking = flagged.filter(n => n.geminiVerdict === 'fake' || n.geminiVerdict === 'misleading').slice(0, 3)
  if (breaking.length === 0) return null

  return (
    <div className="bg-danger/90 text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-white breaking-dot" />
          <span className="text-[11px] font-bold tracking-wider uppercase">Alerta</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-6 breaking-scroll whitespace-nowrap">
            {breaking.map(news => (
              <button key={news.id} onClick={() => onSelectNews(news.id)} className="text-xs font-medium hover:underline shrink-0">
                {news.geminiVerdict === 'fake' ? '🚨 FALSA: ' : '⚠️ ENGAÑOSA: '}{news.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ SHARE BUTTONS ═══════════════ */

function ShareButtons({ news, size = 'sm' }) {
  const [copied, setCopied] = useState(false)
  const url = `https://contextoclaro.com${buildArticlePath(news.id, news.title)}`
  const text = encodeURIComponent(news.title)

  const share = (method, link) => {
    trackShareClick(news.id, method)
    window.open(link, '_blank', 'width=600,height=400')
  }

  const copyLink = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    setCopied(true)
    trackShareClick(news.id, 'copy_link')
    setTimeout(() => setCopied(false), 2000)
  }

  const iconSize = size === 'sm' ? 12 : 14
  const btnClass = size === 'sm'
    ? 'w-6 h-6 rounded-md text-text-muted hover:text-accent hover:bg-accent/10'
    : 'w-8 h-8 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10'

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <button onClick={(e) => { e.stopPropagation(); share('whatsapp', `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`) }} className={`${btnClass} flex items-center justify-center transition-colors`} title="WhatsApp">
        <MessageCircle size={iconSize} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); share('twitter', `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`) }} className={`${btnClass} flex items-center justify-center transition-colors`} title="X (Twitter)">
        <ExternalLink size={iconSize} />
      </button>
      <button onClick={copyLink} className={`${btnClass} flex items-center justify-center transition-colors`} title={copied ? '¡Copiado!' : 'Copiar link'}>
        {copied ? <CheckCircle size={iconSize} className="text-success" /> : <Copy size={iconSize} />}
      </button>
    </div>
  )
}

/* ═══════════════ SHARED COMPONENTS ═══════════════ */

function ScoreBadge({ score, size = "md" }) {
  const s = Number(score) || 0
  const color = s >= 8
    ? 'bg-success text-white'
    : s >= 5
      ? 'bg-warning text-white'
      : 'bg-danger text-white'
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
  return (
    <span className={`${dim} ${color} rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm`}>
      {s.toFixed(1)}
    </span>
  )
}

function VerifiedPill({ veracity }) {
  const config = {
    verificada: { bg: "bg-success-muted", text: "text-success", label: "Verificada" },
    parcialmente_falsa: { bg: "bg-warning-muted", text: "text-warning", label: "Parcialmente falsa" },
    fake: { bg: "bg-danger-muted", text: "text-danger", label: "Información falsa" },
  }
  const c = config[veracity] || config.verificada
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.bg} backdrop-blur-sm`}>
      <CheckCircle size={12} className={c.text} />
      <span className={c.text}>{c.label}</span>
    </span>
  )
}

function GeminiBadge({ verdict, confidence }) {
  if (!verdict) return null
  const config = {
    real: { icon: ShieldCheck, color: 'text-success', bg: 'bg-success-muted', label: 'IA: Real' },
    misleading: { icon: ShieldAlert, color: 'text-warning', bg: 'bg-warning-muted', label: 'IA: Engañosa' },
    fake: { icon: ShieldX, color: 'text-danger', bg: 'bg-danger-muted', label: 'IA: Falsa' },
    unverified: { icon: ShieldQuestion, color: 'text-text-muted', bg: 'bg-surface', label: 'IA: Sin verificar' },
  }
  const c = config[verdict] || config.unverified
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${c.bg}`}>
      <Icon size={12} className={c.color} />
      <span className={c.color}>{c.label}</span>
      {confidence > 0 && <span className="text-text-muted ml-0.5">{confidence}%</span>}
    </span>
  )
}

function BiasBar({ left, center, right }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] font-medium mb-1.5">
        <span className="text-red-600">Izquierda</span>
        <span className="text-gray-500">Centro</span>
        <span className="text-[#1b4f72]">Derecha</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-300 border border-gray-300">
        <div className="bg-red-600 bar-animate" style={{ width: `${left}%` }} />
        <div className="bg-white bar-animate" style={{ width: `${center}%` }} />
        <div className="bg-[#1b4f72] bar-animate" style={{ width: `${right}%` }} />
      </div>
      <div className="flex justify-between text-[11px] font-bold mt-1">
        <span className="text-red-600">{left}%</span>
        <span className="text-gray-500">{center}%</span>
        <span className="text-[#1b4f72]">{right}%</span>
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, icon: Icon, onSeeMore }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center">
            <Icon size={18} className="text-accent" />
          </div>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-heading">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {onSeeMore && (
        <button onClick={onSeeMore} className="text-sm text-accent hover:text-accent-light flex items-center gap-1 shrink-0 transition-colors">
          Ver más <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

function NewsImage({ src, alt, className = "", news, priority = false }) {
  const [failed, setFailed] = useState(false)
  const fallback = news ? getFallbackImage(news) : null

  if ((!src || failed) && fallback) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    )
  }

  if (!src || failed) {
    return (
      <div className={`news-placeholder flex flex-col items-center justify-center gap-2 ${className}`}>
        <Newspaper size={36} className="text-accent/30" aria-hidden="true" />
        <span className="text-[10px] text-text-muted/50 font-medium tracking-wide uppercase">Sin imagen</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

function computeScore(news) {
  if (!news.bias) return 5
  const balance = 10 - Math.abs(news.bias.left - news.bias.right) / 10
  return Math.max(0.1, Math.min(10, balance))
}

/* ═══════════════ LOADING / ERROR ═══════════════ */

function LoadingSkeleton() {
  return (
    <div className="gradient-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 fade-in">
        <img src="/logo.png" alt="Contexto Claro" className="h-14 w-auto pulse-soft" />
        <p className="text-xs text-text-muted pulse-soft">Cargando noticias...</p>
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="gradient-bg flex items-center justify-center">
      <div className="card p-8 max-w-md text-center fade-in">
        <AlertOctagon size={40} className="text-danger mx-auto mb-4" />
        <h2 className="text-lg font-bold font-heading mb-2">Error al cargar</h2>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-light transition-colors">
          Reintentar
        </button>
      </div>
    </div>
  )
}

/* ═══════════════ HEADER ═══════════════ */

function CountryDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = COUNTRIES.find(c => c.code === value) || COUNTRIES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-sm hover:border-border-hover transition-colors"
      >
        <span className="text-base leading-none">{selected.emoji}</span>
        <span className="hidden sm:inline text-text-secondary text-xs">{selected.code === 'ALL' ? 'Todos' : selected.name}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-52 glass-strong rounded-xl overflow-hidden shadow-2xl z-50 fade-in">
            {COUNTRIES.map(c => (
              <button
                key={c.code}
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent-muted transition-colors ${c.code === value ? 'bg-accent-muted text-accent font-medium' : 'text-text-secondary'}`}
              >
                <span className="text-base">{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Header({ onLogoClick, countryCode, onCountryChange, onSelectNews, onSearch, onAboutClick, onCategoryFilter }) {
  const { query, setQuery, results, searching } = useNewsSearch()
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSearchSubmit = () => {
    if (query.trim().length >= 2 && onSearch) {
      onSearch(query.trim())
      setSearchFocused(false)
    }
  }

  const handleResultClick = (id) => {
    if (onSelectNews) onSelectNews(id)
    setQuery('')
    setSearchFocused(false)
  }

  const navItems = [
    { label: 'Política', icon: BarChart3, onClick: () => onCategoryFilter?.('POLÍTICA') },
    { label: 'Economía', icon: TrendingUp, onClick: () => onCategoryFilter?.('ECONOMÍA') },
    { label: 'Deportes', icon: Flame, onClick: () => onCategoryFilter?.('DEPORTES') },
    { label: 'Verificador', icon: ShieldCheck, onClick: () => onCategoryFilter?.('DESINFORMACIÓN') },
    { label: 'Acerca de', icon: Compass, onClick: onAboutClick },
  ]

  return (
    <header className="sticky top-0 z-50 header-dark" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={onLogoClick} aria-label="Ir al inicio — Contexto Claro" className="flex items-center group">
            <img src="/logo.png" alt="Contexto Claro" className="h-10 sm:h-11 w-auto group-hover:brightness-110 transition-all" />
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
            {navItems.map(item => (
              <button key={item.label} onClick={item.onClick} className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-accent transition-colors rounded-lg hover:bg-accent-muted">
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Country Filter */}
            <CountryDropdown value={countryCode} onChange={onCountryChange} />

            {/* Search */}
            <div className={`relative transition-all duration-300 hidden sm:block ${searchFocused ? 'w-72' : 'w-48'}`}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Buscar noticias..."
                aria-label="Buscar noticias"
                value={query}
                onChange={e => { setQuery(e.target.value); if (e.target.value.length >= 3) trackSearch(e.target.value, results?.length || 0) }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit() }}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              />
              {searchFocused && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-strong rounded-xl overflow-hidden shadow-2xl z-50 max-h-80 overflow-y-auto fade-in">
                  {searching ? (
                    <div className="p-4 text-center text-xs text-text-muted pulse-soft">Buscando...</div>
                  ) : results.length > 0 ? (
                    <>
                      {results.map(item => (
                        <div key={item.id} onMouseDown={() => handleResultClick(item.id)} className="p-3 hover:bg-accent-muted cursor-pointer border-b border-border last:border-0 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs">{item.country}</span>
                            <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{item.category}</span>
                          </div>
                          <p className="text-sm font-medium leading-snug">{item.title}</p>
                        </div>
                      ))}
                      <div onMouseDown={handleSearchSubmit} className="p-3 text-center text-xs text-accent font-semibold hover:bg-accent-muted cursor-pointer transition-colors">
                        Ver todos los resultados para &quot;{query}&quot;
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-text-muted">Sin resultados para &quot;{query}&quot;</div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
            >
              {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border py-3 fade-in">
            {/* Mobile search */}
            <div className="relative mb-3 sm:hidden">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar noticias..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleSearchSubmit(); setMobileMenuOpen(false) } }}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(item => (
                <button key={item.label} onClick={() => { if (item.onClick) item.onClick(); setMobileMenuOpen(false) }} className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:text-accent hover:bg-accent-muted rounded-lg transition-colors">
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

/* ═══════════════ HERO CAROUSEL ═══════════════ */

function HeroSection({ news: heroNews, onSelectNews }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const slides = Array.isArray(heroNews) ? heroNews : [heroNews]

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (paused || slides.length <= 1) return
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [paused, slides.length])

  const goTo = (index) => setActive(index)
  const news = slides[active]
  if (!news) return null

  return (
    <section
      className="px-4 sm:px-6 lg:px-8 mt-6"
      aria-label="Noticias destacadas"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative">
        <div
          className="card overflow-hidden cursor-pointer group"
          onClick={() => onSelectNews(news.id)}
          role="group"
          aria-roledescription="slide"
          aria-label={`Noticia ${active + 1} de ${slides.length}: ${news.title}`}
        >
          <div className="flex flex-col lg:flex-row">
            {/* Image */}
            <div className="relative lg:w-[50%] min-h-[220px] sm:min-h-[280px] lg:min-h-[380px] overflow-hidden">
              <div className="absolute inset-0">
                {slides.map((slide, i) => (
                  <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-700 ${i === active ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <NewsImage src={slide.image} alt={slide.title} news={slide} priority={i === 0} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 img-overlay lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-card" />
              {/* Category badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-base/70 backdrop-blur-sm text-text-primary border border-border">
                  {news.category}
                </span>
                <span className="text-xl">{news.country}</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <VerifiedPill veracity={news.veracity} />
                <GeminiBadge verdict={news.geminiVerdict} confidence={news.geminiConfidence} />
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight mb-3 font-heading group-hover:text-accent-light transition-colors hero-text-transition">
                {news.title}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-5 line-clamp-3 hero-text-transition">
                {news.description}
              </p>

              {/* Bias bar */}
              {news.bias && (
                <div className="mb-5 max-w-sm">
                  <BiasBar left={news.bias.left} center={news.bias.center} right={news.bias.right} />
                </div>
              )}

              {/* Sources + read more */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-accent flex items-center gap-1.5">
                  <Eye size={14} aria-hidden="true" /> {news.sourceCount} fuentes
                </span>
                <span className="text-xs text-text-muted">
                  <ChevronRight size={12} className="inline" aria-hidden="true" /> Leer análisis completo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel indicators */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4" role="tablist" aria-label="Controles del carousel">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                role="tab"
                aria-selected={i === active}
                aria-label={`Ir a noticia ${i + 1}: ${slide.title.substring(0, 40)}`}
                className={`relative h-2 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-accent' : 'w-2 bg-text-muted/40 hover:bg-text-muted/60'}`}
              >
                {i === active && !paused && (
                  <span className="absolute inset-0 rounded-full bg-accent-light carousel-progress" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ═══════════════ NEWS CARD (Unified) ═══════════════ */

function FakeBanner({ news }) {
  if (news.geminiVerdict !== 'fake') return null
  return (
    <div className="bg-danger-muted border-b border-danger/30 px-4 py-2 flex items-center gap-2 animate-pulse-subtle">
      <ShieldX size={14} className="text-danger shrink-0" />
      <span className="text-[11px] font-bold text-danger uppercase tracking-wide">Noticia falsa</span>
      {news.geminiConfidence > 0 && (
        <span className="text-[10px] text-danger/70 ml-auto">{news.geminiConfidence}% confianza</span>
      )}
    </div>
  )
}

function NewsCard({ news, onSelectNews, variant = "default" }) {
  const score = computeScore(news)
  const isFake = news.geminiVerdict === 'fake'
  const fakeRing = isFake ? 'ring-2 ring-danger/50' : ''

  if (variant === "featured") {
    const rl = reliabilityLabel(score)
    return (
      <article
        className={`card overflow-hidden cursor-pointer group ${fakeRing}`}
        onClick={() => onSelectNews(news.id)}
      >
        <FakeBanner news={news} />
        <div className="relative h-44 overflow-hidden">
          <NewsImage src={news.image} alt={news.title} news={news} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          <div className="absolute inset-0 img-overlay" />
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${rl.color}`}>{rl.label}</span>
          </div>
          <div className="absolute bottom-3 left-3">
            <VerifiedPill veracity={news.veracity} />
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{news.country}</span>
            <span className="text-[11px] text-text-muted bg-surface px-1.5 py-0.5 rounded font-medium">
              {news.sourceLabel || news.category?.split(' · ')[0]}
            </span>
            <span className="text-[10px] text-text-muted ml-auto flex items-center gap-1"><Clock size={10} />{timeAgo(news.publishedAt)}</span>
          </div>
          <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2 font-heading group-hover:text-accent-light transition-colors">
            {news.title}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
            {news.description}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <GeminiBadge verdict={news.geminiVerdict} confidence={news.geminiConfidence} />
            <ShareButtons news={news} />
          </div>
        </div>
      </article>
    )
  }

  if (variant === "compact") {
    const rl = reliabilityLabel(score)
    return (
      <article
        className={`card overflow-hidden cursor-pointer group ${fakeRing}`}
        onClick={() => onSelectNews(news.id)}
      >
        <FakeBanner news={news} />
        <div className="relative h-36 overflow-hidden">
          <NewsImage src={news.image} alt={news.title} news={news} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${rl.color}`}>{rl.label}</span>
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-base/70 text-text-primary backdrop-blur-sm">
              {news.sourceLabel || news.category?.split(' · ')[0]}
            </span>
          </div>
        </div>
        <div className="p-3.5">
          <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2 font-heading group-hover:text-accent-light transition-colors">
            {news.title}
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-text-muted flex items-center gap-1"><Clock size={10} />{timeAgo(news.publishedAt)}</span>
            <span className="text-[10px] text-text-muted">· {readTime(news)} lectura</span>
          </div>
          <div className="flex items-center justify-between">
            <GeminiBadge verdict={news.geminiVerdict} confidence={news.geminiConfidence} />
            <ShareButtons news={news} />
          </div>
        </div>
      </article>
    )
  }

  if (variant === "investigation") {
    return (
      <article
        className={`card overflow-hidden cursor-pointer group ${fakeRing}`}
        onClick={() => onSelectNews(news.id)}
      >
        <FakeBanner news={news} />
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider bg-accent-muted text-accent">
              {news.category?.split(' · ')[0] || 'Investigaciones'}
            </span>
            <ScoreBadge score={score} size="sm" />
          </div>
          <h3 className="font-bold text-sm leading-snug mb-3 line-clamp-3 font-heading group-hover:text-accent-light transition-colors">
            {news.title}
          </h3>
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center">
              <UserIcon size={12} className="text-text-muted" />
            </div>
            <span className="text-[11px] text-text-muted">{news.author || news.source || 'Redacción'}</span>
          </div>
        </div>
      </article>
    )
  }

  // variant === "blindspot"
  return (
    <article
      className={`card overflow-hidden cursor-pointer group ${fakeRing}`}
      onClick={() => onSelectNews(news.id)}
    >
      <FakeBanner news={news} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{news.country}</span>
            <span className="text-xs font-semibold text-text-primary">
              {news.side || 'Punto ciego'}
            </span>
          </div>
          <ScoreBadge score={score} size="sm" />
        </div>
        <h3 className="font-bold text-sm leading-snug mb-3 line-clamp-3 font-heading group-hover:text-accent-light transition-colors">
          {news.title}
        </h3>
        <span className="text-[11px] text-text-muted">
          {news.sourcesMissing ? `${news.sourcesMissing} fuentes` : `${news.sourceCount || 0} fuentes`}
        </span>
      </div>
    </article>
  )
}

/* ═══════════════ FLAGGED NEWS CARD ═══════════════ */

function FlaggedNewsCard({ news, onSelectNews }) {
  const isFake = news.geminiVerdict === 'fake'
  const borderColor = isFake ? 'border-danger/40' : 'border-warning/40'
  const bgColor = isFake ? 'bg-danger-muted' : 'bg-warning-muted'
  const iconColor = isFake ? 'text-danger' : 'text-warning'
  const label = isFake ? 'FALSA' : 'ENGAÑOSA'
  const Icon = isFake ? ShieldX : ShieldAlert

  return (
    <article
      className={`card overflow-hidden cursor-pointer group border-2 ${borderColor}`}
      onClick={() => onSelectNews(news.id)}
    >
      {/* Warning banner */}
      <div className={`${bgColor} px-4 py-2 flex items-center gap-2`}>
        <Icon size={14} className={iconColor} />
        <span className={`text-[11px] font-bold ${iconColor}`}>{label}</span>
        {news.geminiConfidence > 0 && (
          <span className="text-[10px] text-text-muted ml-auto">{news.geminiConfidence}% confianza</span>
        )}
      </div>

      <div className="flex gap-3 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
          <NewsImage src={news.image} alt={news.title} news={news} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{news.country}</span>
            <span className="text-[10px] text-text-muted">{news.source || news.category?.split(' · ')[0]}</span>
          </div>
          <h3 className="font-bold text-sm leading-snug mb-1.5 line-clamp-2 font-heading">
            {news.title}
          </h3>
          {news.geminiReasoning && (
            <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
              <span className={`font-semibold ${iconColor}`}>IA: </span>
              {news.geminiReasoning}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/* ═══════════════ GRID SECTIONS ═══════════════ */

/* ═══════════════ SPONSORED NEWS CARD ═══════════════ */

function SponsoredNewsCard({ news, onSelectNews }) {
  return (
    <article
      className="sponsored-card overflow-hidden cursor-pointer group rounded-2xl border border-warning/25"
      onClick={() => onSelectNews(news.id)}
    >
      {/* Sponsored banner */}
      <div className="bg-warning/10 px-4 py-2.5 flex items-center gap-2 border-b border-warning/15">
        <div className="w-5 h-5 rounded-md bg-warning/20 flex items-center justify-center">
          <DollarSign size={12} className="text-warning" aria-hidden="true" />
        </div>
        <span className="text-[11px] font-bold text-warning tracking-wide">CONTENIDO PATROCINADO</span>
      </div>

      {/* Image or visual placeholder */}
      <div className="relative h-40 overflow-hidden">
        {news.image ? (
          <>
            <NewsImage src={news.image} alt={news.title} news={news} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full sponsored-placeholder flex flex-col items-center justify-center gap-2">
            <Megaphone size={28} className="text-warning/30" aria-hidden="true" />
            <span className="text-[10px] text-warning/40 font-semibold tracking-wider uppercase">{news.source || 'Patrocinado'}</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="text-base">{news.country}</span>
          <span className="text-[10px] text-text-primary font-medium bg-base/60 backdrop-blur-sm px-2 py-0.5 rounded-md">
            {news.source || news.category?.split(' · ')[0]}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[15px] leading-snug mb-2.5 line-clamp-2 font-heading text-text-primary group-hover:text-accent-light transition-colors">
          {news.title}
        </h3>

        {/* Sponsor info */}
        {news.sponsoredFlag && (
          <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-warning/8 border border-warning/15">
            <Megaphone size={13} className="text-warning shrink-0" aria-hidden="true" />
            <span className="text-xs text-warning font-semibold line-clamp-1">
              Beneficia a: {news.sponsoredFlag}
            </span>
          </div>
        )}

        {news.geminiReasoning && (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
            {news.geminiReasoning}
          </p>
        )}
      </div>
    </article>
  )
}

/* ═══════════════ SCROLL / GRID SECTIONS ═══════════════ */

function ScrollSection({ children }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
      {children}
    </div>
  )
}

function GridSection({ children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}
    </div>
  )
}

/* ═══════════════ METHODOLOGY BANNER ═══════════════ */

function MethodologyBanner({ onMethodologyClick }) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-10">
      <div className="methodology-banner rounded-2xl p-6 sm:p-8 border border-accent/20 overflow-hidden relative">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Icon */}
          <div className="shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center shadow-lg shadow-accent/10">
              <ShieldCheck size={32} className="text-accent" aria-hidden="true" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-extrabold font-heading mb-2 text-text-primary">
              Metodología transparente
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              Cada noticia es analizada por IA y verificada contra múltiples fuentes.
              Evaluamos sesgo político, credibilidad de fuentes y diversidad de cobertura
              para darte el contexto completo.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
                <ShieldCheck size={14} className="text-success" aria-hidden="true" />
                <span className="text-xs font-semibold text-success">Verificación IA</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
                <Eye size={14} className="text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold text-accent">Múltiples fuentes</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle size={14} className="text-warning" aria-hidden="true" />
                <span className="text-xs font-semibold text-warning">Detección de sesgo</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button onClick={onMethodologyClick} className="shrink-0 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors shadow-lg shadow-accent/20">
            Conocer más
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════ STATS BAR ═══════════════ */

function StatsBar({ stats }) {
  if (!stats) return null

  const items = [
    { label: 'Verificadas por IA', value: stats.aiValidated, icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Noticias Reales', value: stats.verified, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Engañosas', value: stats.misleading, icon: ShieldAlert, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Falsas detectadas', value: stats.fake, icon: ShieldX, color: 'text-danger', bg: 'bg-danger/10' },
    { label: 'Patrocinadas', value: stats.sponsored, icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Sesgo Izquierda', value: stats.biasLeft, icon: null, color: 'text-red-600', bg: 'bg-red-50', emoji: '◀' },
    { label: 'Sesgo Centro', value: stats.biasCenter, icon: null, color: 'text-gray-600', bg: 'bg-gray-100', emoji: '◆' },
    { label: 'Sesgo Derecha', value: stats.biasRight, icon: null, color: 'text-[#1b4f72]', bg: 'bg-blue-50', emoji: '▶' },
  ]

  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-8">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-accent" />
          <span className="text-sm font-bold font-heading text-text-primary">Estadísticas en tiempo real</span>
          <span className="text-[10px] text-text-muted ml-auto">{stats.total} noticias analizadas</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3">
          {items.map((item, i) => (
            <div key={i} className={`rounded-xl p-3 text-center ${item.bg} border border-border`}>
              {item.icon ? <item.icon size={16} className={`${item.color} mx-auto mb-1.5`} /> : <span className={`text-sm ${item.color} block mb-1`}>{item.emoji}</span>}
              <p className={`text-lg sm:text-xl font-bold font-heading ${item.color}`}>{item.value}</p>
              <p className="text-[9px] sm:text-[10px] text-text-muted mt-0.5 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════ FOOTER ═══════════════ */

const SocialIcon = ({ name, size = 16 }) => {
  const icons = {
    youtube: <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>,
    x: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>,
    instagram: <><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z"/><path d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/><circle cx="18.406" cy="5.594" r="1.44"/></>,
    tiktok: <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>,
    github: <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>,
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="url(#chrome-gradient)">
      <defs>
        <linearGradient id="chrome-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c0c0c0" />
          <stop offset="25%" stopColor="#e8e8e8" />
          <stop offset="50%" stopColor="#a0a0a0" />
          <stop offset="75%" stopColor="#d4d4d4" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>
      </defs>
      {icons[name]}
    </svg>
  )
}

const SOCIAL_LINKS = [
  { label: 'YouTube', icon: 'youtube', href: 'https://youtube.com/@doncheli' },
  { label: 'X', icon: 'x', href: 'https://x.com/don_cheli' },
  { label: 'Instagram', icon: 'instagram', href: 'https://instagram.com/doncheli.tv' },
  { label: 'TikTok', icon: 'tiktok', href: 'https://tiktok.com/@doncheli.tv' },
  { label: 'GitHub', icon: 'github', href: 'https://github.com/doncheli/contextoclaro' },
]

function Footer({ onAboutClick }) {
  const columns = [
    { title: 'Explorar', links: [
      { label: 'Política', href: '#' },
      { label: 'Economía', href: '#' },
      { label: 'Seguridad', href: '#' },
      { label: 'Deportes', href: '#' },
    ]},
    { title: 'Verificación', links: [
      { label: 'Fake News', href: '#' },
      { label: 'Metodología', href: '#' },
      { label: 'RSS Feed', href: '/rss.xml' },
    ]},
    { title: 'Proyecto', links: [
      { label: 'Acerca de', href: '#', onClick: onAboutClick },
      { label: 'GitHub', href: 'https://github.com/doncheli/contextoclaro', external: true },
      { label: 'Privacidad', href: '/privacy.html' },
      { label: 'Ads.txt', href: '/ads.txt' },
    ]},
  ]

  return (
    <footer className="mt-20 footer-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row justify-between gap-10">
          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 flex-1">
            {columns.map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-bold mb-4 font-heading">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.label}>
                      {link.onClick ? (
                        <button onClick={(e) => { e.preventDefault(); link.onClick() }} className="text-sm hover:text-accent transition-colors">
                          {link.label}
                        </button>
                      ) : (
                        <a href={link.href} {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="text-sm hover:text-accent transition-colors">{link.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Logo + info */}
          <div className="flex flex-col items-start lg:items-end gap-4">
            <img src="/logo.png" alt="Contexto Claro" className="h-10 w-auto" />
            <p className="text-xs text-text-muted max-w-xs text-left lg:text-right leading-relaxed">
              Analizamos la cobertura mediática de Latinoamérica para que puedas
              informarte con contexto y sin sesgo.
            </p>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.label}
                  className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 flex items-center justify-center hover:border-gray-300 hover:shadow-md hover:scale-105 transition-all"
                >
                  <SocialIcon name={social.icon} size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Contexto Claro" className="h-8 w-auto opacity-80" />
            <span className="text-xs text-text-muted">&copy; {new Date().getFullYear()} Contexto Claro — contextoclaro.com</span>
          </div>
          <span className="text-xs text-text-muted">Hecho con transparencia para Latinoamérica</span>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════ METHODOLOGY PAGE ═══════════════ */

function FlowArrow() {
  return (
    <div className="flex justify-center py-3">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
        <path d="M12 0V24M12 24L4 16M12 24L20 16" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function FlowStep({ number, title, description, icon, color, details }) {
  const colors = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-600' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-600' },
  }
  const c = colors[color] || colors.blue
  return (
    <div className={`${c.bg} ${c.border} border-2 rounded-2xl p-6 sm:p-8 relative`}>
      <div className="flex items-start gap-4">
        <div className={`${c.badge} text-white w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0`}>
          {number}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold font-heading ${c.text} mb-2`}>{title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">{description}</p>
          {details && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {details.map((d, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg p-3 border border-white">
                  <span className="text-lg">{d.icon}</span>
                  <div>
                    <span className="text-xs font-bold text-text-primary block">{d.label}</span>
                    <span className="text-xs text-text-muted">{d.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScoreExplainer({ label, score, color, desc }) {
  const barColor = color === 'green' ? 'bg-green-500' : color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-purple-500'
  return (
    <div className="card p-5 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-text-primary">{label}</span>
        <span className={`text-sm font-black ${color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : 'text-purple-600'}`}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden mb-3">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
    </div>
  )
}

function MethodologyPage({ onClose, headerProps, openAbout }) {
  return (
    <div className="gradient-bg" lang="es">
      <Header onLogoClick={onClose} {...headerProps} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/10">
            <ShieldCheck size={32} className="text-accent" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-text-primary mb-4">
            Nuestra metodolog&iacute;a
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            As&iacute; es como analizamos cada noticia que llega a Contexto Claro.
            Todo el proceso es autom&aacute;tico, transparente y dise&ntilde;ado para que
            t&uacute; tengas la informaci&oacute;n m&aacute;s completa posible.
          </p>
        </div>

        {/* Visual Flow Diagram */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold font-heading mb-2 text-text-primary text-center">El recorrido de cada noticia</h2>
          <p className="text-sm text-text-muted text-center mb-10">Desde que se publica hasta que llega a ti, verificada</p>

          <div className="max-w-2xl mx-auto">
            <FlowStep
              number="1"
              color="blue"
              title="Recopilaci&oacute;n autom&aacute;tica"
              description="Nuestro sistema monitorea en tiempo real cientos de medios de comunicaci&oacute;n de toda Latinoam&eacute;rica. Cada vez que se publica una noticia relevante, la capturamos autom&aacute;ticamente."
              details={[
                { icon: '📡', label: 'Monitoreo 24/7', desc: 'Rastreamos medios de Venezuela, Colombia, M\u00e9xico, Argentina, Chile y m\u00e1s' },
                { icon: '🗞️', label: 'Todas las categor\u00edas', desc: 'Pol\u00edtica, econom\u00eda, seguridad, deportes, tecnolog\u00eda' },
                { icon: '🌐', label: 'M\u00faltiples fuentes', desc: 'No dependemos de un solo medio — capturamos la mayor cantidad posible' },
                { icon: '⚡', label: 'En tiempo real', desc: 'Las noticias aparecen minutos despu\u00e9s de ser publicadas' },
              ]}
            />

            <FlowArrow />

            <FlowStep
              number="2"
              color="green"
              title="An&aacute;lisis con Inteligencia Artificial"
              description="Cada noticia pasa por nuestro motor de IA que la analiza desde m&uacute;ltiples &aacute;ngulos. No es una simple b&uacute;squeda de palabras clave — es un an&aacute;lisis profundo del contenido."
              details={[
                { icon: '🧠', label: 'Comprensi\u00f3n del texto', desc: 'La IA lee y entiende el contexto completo de la noticia' },
                { icon: '🔍', label: 'Detecci\u00f3n de patrones', desc: 'Identifica lenguaje manipulador, exageraciones y omisiones' },
                { icon: '📊', label: 'Cruce de datos', desc: 'Compara la informaci\u00f3n con datos verificados y fuentes oficiales' },
                { icon: '🎯', label: 'An\u00e1lisis de tono', desc: 'Detecta si el tono es informativo, sensacionalista o propagand\u00edstico' },
              ]}
            />

            <FlowArrow />

            <FlowStep
              number="3"
              color="amber"
              title="Verificaci&oacute;n y clasificaci&oacute;n"
              description="Basado en el an&aacute;lisis, la IA clasifica cada noticia en una de tres categor&iacute;as. Adem&aacute;s, asigna un porcentaje de confianza para que sepas qu&eacute; tan segura est&aacute; la IA de su veredicto."
            />

            {/* Verdict cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-4">
              <div className="rounded-xl p-4 bg-green-50 border-2 border-green-200 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck size={20} className="text-green-600" />
                </div>
                <span className="text-sm font-black text-green-700 block">REAL</span>
                <p className="text-xs text-green-600 mt-1">La informaci&oacute;n es coherente y verificable</p>
              </div>
              <div className="rounded-xl p-4 bg-amber-50 border-2 border-amber-200 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                  <ShieldAlert size={20} className="text-amber-600" />
                </div>
                <span className="text-sm font-black text-amber-700 block">ENGA&Ntilde;OSA</span>
                <p className="text-xs text-amber-600 mt-1">Contiene informaci&oacute;n parcial o manipulada</p>
              </div>
              <div className="rounded-xl p-4 bg-red-50 border-2 border-red-200 text-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                  <ShieldX size={20} className="text-red-600" />
                </div>
                <span className="text-sm font-black text-red-700 block">FALSA</span>
                <p className="text-xs text-red-600 mt-1">La informaci&oacute;n es falsa o fabricada</p>
              </div>
            </div>

            <FlowArrow />

            <FlowStep
              number="4"
              color="purple"
              title="Puntuaci&oacute;n de confiabilidad"
              description="Adem&aacute;s de la clasificaci&oacute;n, cada noticia recibe una puntuaci&oacute;n del 0 al 100 basada en cuatro m&eacute;tricas clave. Esta puntuaci&oacute;n te dice qu&eacute; tan confiable es la noticia en general."
            />

            {/* Score breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 mb-4">
              <ScoreExplainer label="Precisi&oacute;n factual" score={85} color="green" desc="&iquest;La informaci&oacute;n presentada es precisa y verificable? Se compara con datos oficiales y fuentes comprobables." />
              <ScoreExplainer label="Diversidad de fuentes" score={70} color="blue" desc="&iquest;Cu&aacute;ntos medios diferentes cubren esta noticia? M&aacute;s fuentes = mayor confiabilidad." />
              <ScoreExplainer label="Transparencia" score={75} color="amber" desc="&iquest;La fuente identifica al autor, cita fuentes y separa opini&oacute;n de informaci&oacute;n?" />
              <ScoreExplainer label="Independencia" score={60} color="purple" desc="&iquest;La cobertura es equilibrada o favorece una postura pol&iacute;tica o comercial espec&iacute;fica?" />
            </div>

            {/* Score formula visual */}
            <div className="card p-6 border border-border mt-4 mb-4">
              <h4 className="text-sm font-bold text-text-primary mb-4 text-center">C&oacute;mo se calcula la puntuaci&oacute;n final</h4>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
                <span className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 font-bold">Factual &times; 35%</span>
                <span className="text-text-muted font-bold">+</span>
                <span className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold">Fuentes &times; 25%</span>
                <span className="text-text-muted font-bold">+</span>
                <span className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold">Transparencia &times; 25%</span>
                <span className="text-text-muted font-bold">+</span>
                <span className="px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 font-bold">Independencia &times; 15%</span>
                <span className="text-text-muted font-bold">=</span>
                <span className="px-4 py-2 rounded-lg bg-accent text-white font-black text-sm">Puntuaci&oacute;n</span>
              </div>
            </div>

            <FlowArrow />

            <FlowStep
              number="5"
              color="red"
              title="Detecci&oacute;n de sesgo pol&iacute;tico"
              description="Analizamos la orientaci&oacute;n pol&iacute;tica de las fuentes que cubren cada noticia. No es que un sesgo sea &laquo;malo&raquo; — pero t&uacute; mereces saber desde qu&eacute; perspectiva te est&aacute;n informando."
            />

            {/* Bias visual */}
            <div className="card p-6 border border-border mt-4 mb-4">
              <h4 className="text-sm font-bold text-text-primary mb-4 text-center">Espectro de sesgo pol&iacute;tico</h4>
              <div className="max-w-sm mx-auto">
                <div className="flex h-5 rounded-full overflow-hidden border border-gray-300 mb-3">
                  <div className="bg-red-600" style={{ width: '30%' }} />
                  <div className="bg-white border-x border-gray-200" style={{ width: '40%' }} />
                  <div className="bg-[#1b4f72]" style={{ width: '30%' }} />
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-red-600">Izquierda</span>
                  <span className="text-gray-500">Centro</span>
                  <span className="text-[#1b4f72]">Derecha</span>
                </div>
              </div>
              <p className="text-xs text-text-muted text-center mt-4 max-w-md mx-auto">
                Cada noticia muestra qu&eacute; porcentaje de fuentes de izquierda, centro y derecha la cubren.
                Un balance m&aacute;s equilibrado indica cobertura m&aacute;s diversa.
              </p>
            </div>

            <FlowArrow />

            <FlowStep
              number="6"
              color="blue"
              title="T&uacute; decides"
              description="Con toda esta informaci&oacute;n — verificaci&oacute;n de IA, puntuaci&oacute;n de confiabilidad, desglose de m&eacute;tricas y espectro de sesgo — t&uacute; tienes todo lo que necesitas para formarte tu propia opini&oacute;n. No te decimos qu&eacute; pensar. Te damos el contexto para que pienses por ti mismo."
            />
          </div>
        </section>

        {/* Score ranges */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold font-heading mb-8 text-text-primary text-center">&iquest;Qu&eacute; significa cada puntuaci&oacute;n?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { range: '85 – 100', label: 'Muy fiable', color: 'bg-green-500', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', desc: 'Informaci\u00f3n verificada, m\u00faltiples fuentes, transparencia alta' },
              { range: '70 – 84', label: 'Fiable', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', desc: 'Informaci\u00f3n generalmente precisa, buena diversidad de fuentes' },
              { range: '50 – 69', label: 'Precauci\u00f3n', color: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', desc: 'Informaci\u00f3n parcial, pocas fuentes o sesgo notable' },
              { range: '0 – 49', label: 'No fiable', color: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', desc: 'Informaci\u00f3n probablemente falsa, manipulada o sin verificar' },
            ].map((item, i) => (
              <div key={i} className={`${item.bg} ${item.border} border-2 rounded-xl p-5 text-center`}>
                <div className={`w-14 h-14 rounded-full ${item.color} flex items-center justify-center mx-auto mb-3`}>
                  <span className="text-white text-sm font-black">{item.range.split(' ')[0]}</span>
                </div>
                <span className={`text-sm font-black ${item.text} block mb-1`}>{item.label}</span>
                <span className="text-xs text-text-secondary block mb-2">{item.range} puntos</span>
                <p className="text-xs text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold font-heading mb-8 text-text-primary text-center">Preguntas frecuentes</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              { q: '\u00bfLa IA puede equivocarse?', a: 'S\u00ed. Ning\u00fan sistema es perfecto. Por eso mostramos el porcentaje de confianza de cada veredicto y todas las m\u00e9tricas del an\u00e1lisis, para que t\u00fa puedas juzgar por tu cuenta.' },
              { q: '\u00bfQui\u00e9n controla la IA?', a: 'Nadie la "controla" editorialmente. El c\u00f3digo es open source y cualquier persona puede auditarlo en GitHub. No hay intervenci\u00f3n humana en las clasificaciones.' },
              { q: '\u00bfPor qu\u00e9 una noticia tiene puntuaci\u00f3n baja?', a: 'Puede ser por varias razones: pocas fuentes la cubren, la fuente principal no es transparente, hay sesgo marcado, o la informaci\u00f3n no se puede verificar con datos oficiales.' },
              { q: '\u00bfContexto Claro tiene sesgo pol\u00edtico?', a: 'No. Analizamos fuentes de todos los espectros pol\u00edticos. El sistema mide el sesgo, no lo aplica. Nuestro c\u00f3digo abierto permite verificar esto.' },
              { q: '\u00bfC\u00f3mo puedo reportar un error?', a: 'Puedes escribirnos a trav\u00e9s de nuestras redes sociales o abrir un issue en GitHub. Cada reporte nos ayuda a mejorar.' },
            ].map((item, i) => (
              <div key={i} className="card p-5 border border-border">
                <h4 className="text-sm font-bold text-text-primary mb-2">{item.q}</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <button onClick={openAbout} className="px-6 py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors">
            Conoce m&aacute;s sobre Contexto Claro
          </button>
        </div>

      </main>
      <Footer onAboutClick={openAbout} />
    </div>
  )
}

/* ═══════════════ ABOUT PAGE ═══════════════ */

function AboutPage({ onClose, headerProps }) {
  return (
    <div className="gradient-bg" lang="es">
      <Header onLogoClick={onClose} {...headerProps} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Hero section */}
        <div className="text-center mb-16">
          <img src="/logo.png" alt="Contexto Claro" className="h-16 sm:h-20 w-auto mx-auto mb-8" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-text-primary leading-tight mb-4">
            La verdad no tiene dueño.<br />
            <span className="text-accent">El contexto s&iacute;.</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Contexto Claro es una plataforma de verificaci&oacute;n y an&aacute;lisis de medios
            que usa inteligencia artificial para que puedas informarte sin sesgos,
            sin manipulaci&oacute;n y sin agendas ocultas.
          </p>
        </div>

        {/* Problem */}
        <section className="mb-16">
          <div className="card p-8 sm:p-10 border border-danger/20 bg-gradient-to-br from-danger-muted to-transparent">
            <h2 className="text-2xl font-bold font-heading mb-4 text-danger">El problema</h2>
            <div className="space-y-4 text-text-secondary leading-relaxed">
              <p>
                En Latinoam&eacute;rica, las noticias falsas no son un error &mdash; son una industria. Cada d&iacute;a,
                millones de personas consumen informaci&oacute;n dise&ntilde;ada para manipular, polarizar y dividir.
                Los medios tradicionales responden a intereses pol&iacute;ticos y econ&oacute;micos. Las redes sociales
                amplifican lo que genera clicks, no lo que es verdad.
              </p>
              <p>
                El resultado: sociedades desinformadas que toman decisiones basadas en mentiras.
                Elecciones influenciadas. Econom&iacute;as da&ntilde;adas. Democracias debilitadas.
              </p>
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold font-heading mb-8 text-text-primary">La soluci&oacute;n: Contexto Claro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: '🔍',
                title: 'Verificaci&oacute;n con IA',
                desc: 'Cada noticia es analizada autom&aacute;ticamente por inteligencia artificial que eval&uacute;a su veracidad, detecta propaganda y se&ntilde;ales de manipulaci&oacute;n.',
              },
              {
                icon: '⚖️',
                title: 'An&aacute;lisis de sesgo',
                desc: 'Mostramos el espectro pol&iacute;tico de cada noticia: izquierda, centro y derecha. T&uacute; decides, con toda la informaci&oacute;n sobre la mesa.',
              },
              {
                icon: '📊',
                title: 'M&uacute;ltiples fuentes',
                desc: 'No dependes de una sola versi&oacute;n. Agregamos y comparamos c&oacute;mo cubren la misma historia diferentes medios de toda la regi&oacute;n.',
              },
              {
                icon: '🌎',
                title: 'Hecho para Latinoam&eacute;rica',
                desc: 'Dise&ntilde;ado espec&iacute;ficamente para nuestra regi&oacute;n: Venezuela, Colombia, M&eacute;xico, Argentina, Chile y m&aacute;s. Nuestro contexto, nuestras noticias.',
              },
            ].map((item, i) => (
              <div key={i} className="card p-6 border border-border hover:border-accent/30 transition-colors">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold font-heading mb-2 text-text-primary" dangerouslySetInnerHTML={{ __html: item.title }} />
                <p className="text-sm text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: item.desc }} />
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold font-heading mb-8 text-text-primary">C&oacute;mo funciona</h2>
          <div className="space-y-6">
            {[
              { step: '01', title: 'Recopilamos', desc: 'Nuestro sistema monitorea en tiempo real cientos de medios de comunicaci&oacute;n de toda Latinoam&eacute;rica.' },
              { step: '02', title: 'Analizamos', desc: 'La IA eval&uacute;a cada noticia: precisi&oacute;n factual, diversidad de fuentes, transparencia e independencia editorial.' },
              { step: '03', title: 'Verificamos', desc: 'Clasificamos cada noticia como Real, Enga&ntilde;osa o Falsa, con un porcentaje de confianza y razonamiento detallado.' },
              { step: '04', title: 'Presentamos', desc: 'Te mostramos la noticia con todo su contexto: sesgo pol&iacute;tico, puntuaci&oacute;n de fiabilidad y c&oacute;mo la cubren otros medios.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center text-lg font-black font-heading shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-bold font-heading text-text-primary mb-1">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: item.desc }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open Source */}
        <section className="mb-16">
          <div className="card p-8 sm:p-10 border border-accent/20 bg-gradient-to-br from-accent-muted to-transparent">
            <h2 className="text-2xl font-bold font-heading mb-4 text-accent">C&oacute;digo abierto: democratizar la verdad</h2>
            <div className="space-y-4 text-text-secondary leading-relaxed">
              <p>
                Contexto Claro es <strong className="text-text-primary">100% open source</strong>.
                El c&oacute;digo est&aacute; en GitHub para que cualquier persona lo pueda auditar, mejorar y replicar.
                Porque la lucha contra la desinformaci&oacute;n no puede ser un negocio cerrado &mdash;
                tiene que ser un esfuerzo colectivo.
              </p>
              <p>
                Si eres desarrollador, periodista o simplemente alguien que cree en la verdad,
                puedes contribuir. La informaci&oacute;n verificada es un derecho, no un privilegio.
              </p>
              <a
                href="https://github.com/doncheli/contextoclaro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 px-6 py-3 rounded-xl bg-text-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                Ver en GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Origin story + DonCheli */}
        <section className="mb-16">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            <div className="shrink-0">
              <img
                src="/doncheli.png"
                alt="DonCheli - Creador de Contexto Claro"
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-cover shadow-xl border-4 border-white"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-heading mb-4 text-text-primary">Un proyecto nacido en vivo</h2>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  Contexto Claro naci&oacute; durante un <strong className="text-text-primary">LIVE de @doncheli</strong>,
                  donde la idea de crear una herramienta que analizara noticias con IA surgi&oacute; de forma
                  espont&aacute;nea frente a la audiencia. Lo que comenz&oacute; como una conversaci&oacute;n en vivo
                  se convirti&oacute; en un proyecto real, construido paso a paso con la comunidad.
                </p>
                <p>
                  La misi&oacute;n es simple: <strong className="text-text-primary">que nadie te mienta</strong>.
                  Que puedas abrir un sitio y saber si lo que est&aacute;s leyendo es real, enga&ntilde;oso o
                  directamente falso. Sin pagar, sin muros, sin agenda.
                </p>
                <p>
                  Si crees en este proyecto, la mejor forma de apoyar es compartirlo y seguir
                  a @doncheli en redes para estar al d&iacute;a con las actualizaciones.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social CTA */}
        <section className="mb-8">
          <div className="card p-8 sm:p-10 text-center border border-border">
            <h2 className="text-2xl font-bold font-heading mb-3 text-text-primary">S&eacute; parte del movimiento</h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              S&iacute;gueme en redes sociales para que no te pierdas ning&uacute;n LIVE,
              actualizaci&oacute;n del proyecto y contenido sobre tecnolog&iacute;a e IA.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {SOCIAL_LINKS.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-sm font-semibold text-text-primary hover:border-gray-300 hover:shadow-lg hover:scale-105 transition-all"
                >
                  <SocialIcon name={social.icon} size={20} />
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer onAboutClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </div>
  )
}

/* ═══════════════ SEARCH RESULTS VIEW ═══════════════ */

function SearchResultsView({ query, onClose, onSelectNews, headerProps }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    searchNews(query, 100).then(data => {
      const sorted = [...data].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      setResults(sorted)
    }).catch(() => setResults([])).finally(() => setLoading(false))
  }, [query])

  return (
    <div className="gradient-bg" lang="es">
      <Header onLogoClick={onClose} {...headerProps} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="text-text-secondary hover:text-accent transition-colors">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-heading">Resultados para &ldquo;{query}&rdquo;</h1>
            <p className="text-xs text-text-muted">
              {loading ? 'Buscando...' : `${results.length} noticias encontradas · Más recientes primero`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="text-sm text-text-muted pulse-soft">Buscando noticias...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map(news => (
              <NewsCard key={news.id} news={news} onSelectNews={onSelectNews} variant="compact" />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Search size={32} className="text-text-muted/40 mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No se encontraron noticias para &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </main>
      <Footer onAboutClick={openAbout} />
    </div>
  )
}

/* ═══════════════ MAIN APP ═══════════════ */

export default function App() {
  const [selectedNewsId, setSelectedNewsId] = useState(() => parseArticleIdFromPath())
  const [countryCode, setCountryCode] = useState('ALL')
  const [showAllNews, setShowAllNews] = useState(false)
  const [visibleCount, setVisibleCount] = useState(24)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState(null)
  const [showAbout, setShowAbout] = useState(() => window.location.pathname === '/acerca-de')
  const [showMethodology, setShowMethodology] = useState(() => window.location.pathname === '/metodologia')
  const handleCountryChange = (code) => { trackCountryFilter(code); setCountryCode(code) }
  const { hero, daily, blindspot, feed, flagged, sponsored, allNews, stats, loading, error } = useNewsSections(countryCode)

  const scrollPosRef = useRef(0)

  const showAllRef = useRef(false)

  const allNewsRef = useRef(allNews)
  allNewsRef.current = allNews

  const selectNews = useCallback((id) => {
    if (id) {
      scrollPosRef.current = window.scrollY
      showAllRef.current = showAllNews
      window.scrollTo({ top: 0 })
    }
    setSelectedNewsId(id)
    if (id) {
      const news = allNewsRef.current?.find(n => n.id === id)
      const path = buildArticlePath(id, news?.title)
      window.history.pushState({ articleId: id, scrollY: scrollPosRef.current, fromAllNews: showAllNews }, '', path)
    } else {
      window.history.pushState({}, '', '/')
    }
  }, [showAllNews])

  const closeArticle = useCallback(() => {
    const wasInAllNews = showAllRef.current
    if (wasInAllNews) setShowAllNews(true)
    setSelectedNewsId(null)
    window.history.pushState({}, '', '/')
    const savedPos = scrollPosRef.current
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedPos })
      })
    })
  }, [])

  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    setSelectedNewsId(null)
    setShowAllNews(false)
    setShowAbout(false)
    window.scrollTo({ top: 0 })
  }, [])

  const openAbout = useCallback(() => {
    setShowAbout(true)
    setShowMethodology(false)
    setSelectedNewsId(null)
    setShowAllNews(false)
    setSearchQuery(null)
    window.history.pushState({ page: 'about' }, '', '/acerca-de')
    window.scrollTo({ top: 0 })
  }, [])

  const openMethodology = useCallback(() => {
    setShowMethodology(true)
    setShowAbout(false)
    setSelectedNewsId(null)
    setShowAllNews(false)
    setSearchQuery(null)
    window.history.pushState({ page: 'methodology' }, '', '/metodologia')
    window.scrollTo({ top: 0 })
  }, [])

  const filterByCategory = useCallback((cat) => {
    setCategoryFilter(cat)
    setShowAllNews(true)
    setSelectedNewsId(null)
    setShowAbout(false)
    setShowMethodology(false)
    setSearchQuery(null)
    setVisibleCount(24)
    window.scrollTo({ top: 0 })
  }, [])

  const headerProps = {
    countryCode,
    onCountryChange: handleCountryChange,
    onSelectNews: selectNews,
    onSearch: handleSearch,
    onAboutClick: openAbout,
    onCategoryFilter: filterByCategory,
  }

  useEffect(() => {
    const handlePopState = (event) => {
      const page = event.state?.page
      setShowAbout(page === 'about')
      setShowMethodology(page === 'methodology')
      setSearchQuery(null)
      if (event.state?.articleId) {
        setSelectedNewsId(event.state.articleId)
        setShowAllNews(false)
        window.scrollTo({ top: 0 })
      } else if (page) {
        setSelectedNewsId(null)
        setShowAllNews(false)
        window.scrollTo({ top: 0 })
      } else {
        if (event.state?.fromAllNews) setShowAllNews(true)
        setSelectedNewsId(null)
        const savedPos = event.state?.scrollY || scrollPosRef.current
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedPos })
        })
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  if (!hero) return <ErrorState message="No se encontraron noticias" />

  if (selectedNewsId) {
    return (
      <div className="gradient-bg">
        <Header onLogoClick={closeArticle} {...headerProps} />
        <ArticleView
          newsId={selectedNewsId}
          allNews={allNews}
          onClose={closeArticle}
          onSelectNews={selectNews}
        />
        <Footer onAboutClick={openAbout} />
      </div>
    )
  }

  if (showAbout) {
    return <AboutPage onClose={() => { setShowAbout(false); window.history.pushState({}, '', '/') }} headerProps={headerProps} />
  }

  if (showMethodology) {
    return <MethodologyPage onClose={() => { setShowMethodology(false); window.history.pushState({}, '', '/') }} headerProps={headerProps} openAbout={openAbout} />
  }

  if (searchQuery) {
    return <SearchResultsView query={searchQuery} onClose={() => setSearchQuery(null)} onSelectNews={selectNews} headerProps={headerProps} />
  }

  if (showAllNews) {
    const sorted = [...allNews].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    const filtered = categoryFilter === 'ALL' ? sorted : sorted.filter(n => (n.category || '').toUpperCase().includes(categoryFilter))
    const visible = filtered.slice(0, visibleCount)
    return (
      <div className="gradient-bg" lang="es">
        <Header onLogoClick={() => { setShowAllNews(false); setVisibleCount(24) }} {...headerProps} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowAllNews(false); setVisibleCount(24); setCategoryFilter('ALL') }} className="text-text-secondary hover:text-accent transition-colors">
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <div>
                <h1 className="text-xl font-bold font-heading">Todas las Noticias</h1>
                <p className="text-xs text-text-muted">{filtered.length} noticias · Ordenadas por fecha</p>
              </div>
            </div>
          </div>
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => { setCategoryFilter(cat.key); setVisibleCount(24) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat.key ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-accent/50'}`}>
                {cat.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map(news => (
              <NewsCard key={news.id} news={news} onSelectNews={selectNews} variant="compact" />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisibleCount(prev => prev + 24)}
                className="px-8 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors"
              >
                Cargar más noticias ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </main>
        <Footer onAboutClick={openAbout} />
      </div>
    )
  }

  const topStories = feed.slice(0, 12)
  const topStoryIds = new Set(topStories.map(n => n.id))
  const heroIds = new Set((hero || []).map(n => n.id))
  const investigations = daily.filter(n => !topStoryIds.has(n.id) && !heroIds.has(n.id)).slice(0, 8)
  // Trending = noticias con más fuentes (proxy de popularidad)
  const trending = [...allNews].sort((a, b) => (b.sourceCount || 0) - (a.sourceCount || 0)).filter(n => !topStoryIds.has(n.id)).slice(0, 5)

  return (
    <div className="gradient-bg" lang="es">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <Header onLogoClick={() => { setSearchQuery(null); closeArticle() }} {...headerProps} />
      <BreakingNewsBanner flagged={flagged} onSelectNews={selectNews} />

      <main id="main-content" role="main" aria-label="Contenido principal" className="max-w-7xl mx-auto pb-8">
        {/* Hero Carousel */}
        <HeroSection news={hero} onSelectNews={selectNews} />

        {/* Stats Bar */}
        <StatsBar stats={stats} />

        {/* Trending / Lo más cubierto */}
        {trending.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-10">
            <SectionHeader title="Tendencias" subtitle="Lo más cubierto por múltiples fuentes" icon={Flame} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {trending.map((news, i) => (
                <article key={news.id} className="card p-3 cursor-pointer group hover:border-accent/30 transition-colors flex items-start gap-3" onClick={() => selectNews(news.id)}>
                  <span className="text-xl font-black text-accent/30 font-heading shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-accent-light transition-colors">{news.title}</h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-text-muted">{news.sourceLabel}</span>
                      <span className="text-[9px] text-text-muted">· {timeAgo(news.publishedAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Resumen Diario */}
        {daily.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12 slide-up">
            <SectionHeader title="Resumen Diario" subtitle="Las noticias más relevantes de hoy" icon={TrendingUp} onSeeMore={() => { setShowAllNews(true); setVisibleCount(24); window.scrollTo({ top: 0 }) }} />
            <ScrollSection>
              {daily.map(news => (
                <div key={news.id} className="min-w-[280px] max-w-[300px] shrink-0">
                  <NewsCard news={news} onSelectNews={selectNews} variant="featured" />
                </div>
              ))}
            </ScrollSection>
          </section>
        )}

        {/* Ad: between sections */}
        <div className="px-4 sm:px-6 lg:px-8">
          <AdBanner variant="section-break" />
        </div>

        {/* Methodology Banner */}
        <MethodologyBanner onMethodologyClick={openMethodology} />

        {/* Top News Stories - Grid layout */}
        {topStories.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12">
            <SectionHeader title="Noticias Principales" subtitle="Cobertura verificada de múltiples fuentes" icon={BarChart3} onSeeMore={() => { setShowAllNews(true); setVisibleCount(24); window.scrollTo({ top: 0 }) }} />
            <GridSection>
              {topStories.map((news, i) => (
                <React.Fragment key={news.id}>
                  <NewsCard news={news} onSelectNews={selectNews} variant="compact" />
                  {i === 4 && <AdBanner variant="feed-inline" />}
                </React.Fragment>
              ))}
            </GridSection>
          </section>
        )}

        {/* Ad: between sections */}
        <div className="px-4 sm:px-6 lg:px-8">
          <AdBanner variant="section-break" />
        </div>

        {/* Investigaciones */}
        {investigations.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12">
            <SectionHeader title="Investigaciones" subtitle="Análisis en profundidad" icon={Eye} onSeeMore={() => { setShowAllNews(true); setVisibleCount(24); window.scrollTo({ top: 0 }) }} />
            <ScrollSection>
              {investigations.map(news => (
                <div key={news.id} className="min-w-[260px] max-w-[280px] shrink-0">
                  <NewsCard news={news} onSelectNews={selectNews} variant="investigation" />
                </div>
              ))}
            </ScrollSection>
          </section>
        )}

        {/* Alertas de Desinformación */}
        {flagged.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12" ref={el => { if (el) { const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { trackSectionView('desinformacion'); flagged.forEach(n => trackFakeNewsAlertView(n)); obs.disconnect() } }); obs.observe(el) } }}>
            <SectionHeader title="Alertas de Desinformación" subtitle="Noticias detectadas como falsas o engañosas por nuestra IA" icon={AlertTriangle} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {flagged.map(news => (
                <FlaggedNewsCard key={news.id} news={news} onSelectNews={selectNews} />
              ))}
            </div>
          </section>
        )}

        {/* Noticias Patrocinadas */}
        {sponsored.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12" ref={el => { if (el) { const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { trackSectionView('patrocinadas'); sponsored.forEach(n => trackSponsoredAlertView(n)); obs.disconnect() } }); obs.observe(el) } }}>
            <SectionHeader title="Noticias Patrocinadas" subtitle="Contenido detectado como pagado, propaganda o comunicado disfrazado de noticia" icon={DollarSign} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sponsored.map(news => (
                <SponsoredNewsCard key={news.id} news={news} onSelectNews={selectNews} />
              ))}
            </div>
          </section>
        )}

        {/* Ad: before blindspots */}
        <div className="px-4 sm:px-6 lg:px-8">
          <AdBanner variant="section-break" />
        </div>

        {/* Blindspots Regionales */}
        {blindspot.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12">
            <SectionHeader title="Puntos Ciegos" subtitle="Noticias con cobertura desbalanceada" icon={Compass} onSeeMore={() => { setShowAllNews(true); setVisibleCount(24); window.scrollTo({ top: 0 }) }} />
            <ScrollSection>
              {blindspot.map(news => (
                <div key={news.id} className="min-w-[260px] max-w-[280px] shrink-0">
                  <NewsCard news={news} onSelectNews={selectNews} variant="blindspot" />
                </div>
              ))}
            </ScrollSection>
          </section>
        )}
      </main>

      <Footer onAboutClick={openAbout} />
    </div>
  )
}
