import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Eye, CheckCircle, AlertOctagon,
  ChevronRight, User as UserIcon, ChevronDown,
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Menu, X, TrendingUp, BarChart3, Compass, Newspaper, AlertTriangle, DollarSign, Megaphone
} from 'lucide-react'
import ArticleView from './NewsDetailModal'
import { useNewsSections, useNewsSearch } from './hooks/useNews'
import AdBanner from './components/AdBanner'
import {
  trackCountryFilter, trackSearch, trackSectionView,
  trackFakeNewsAlertView, trackSponsoredAlertView, trackAdImpression
} from './lib/analytics'
import { getFallbackImage } from './lib/categoryImages'

const COUNTRIES = [
  { code: 'ALL', name: 'Todos los países', emoji: '🌎' },
  { code: 'VE', name: 'Venezuela', emoji: '🇻🇪' },
  { code: 'CO', name: 'Colombia', emoji: '🇨🇴' },
]

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
      <div className="flex justify-between text-[11px] font-medium text-text-secondary mb-1.5">
        <span>Izquierda</span>
        <span>Centro</span>
        <span>Derecha</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-base/50">
        <div className="bg-bias-left bar-animate" style={{ width: `${left}%` }} />
        <div className="bg-bias-center bar-animate" style={{ width: `${center}%` }} />
        <div className="bg-bias-right bar-animate" style={{ width: `${right}%` }} />
      </div>
      <div className="flex justify-between text-[11px] font-bold mt-1">
        <span className="text-bias-left">{left}%</span>
        <span className="text-bias-center">{center}%</span>
        <span className="text-bias-right">{right}%</span>
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

function NewsImage({ src, alt, className = "", news }) {
  const [failed, setFailed] = useState(false)
  const fallback = news ? getFallbackImage(news) : null

  if ((!src || failed) && fallback) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        loading="lazy"
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

function Header({ onLogoClick, countryCode, onCountryChange }) {
  const { query, setQuery, results, searching } = useNewsSearch()
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { label: 'Blindspot', icon: Eye },
    { label: 'Política', icon: BarChart3 },
    { label: 'Economía', icon: TrendingUp },
    { label: 'Verificador', icon: ShieldCheck },
  ]

  return (
    <header className="sticky top-0 z-50 glass-strong" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={onLogoClick} aria-label="Ir al inicio — Contexto Claro" className="flex items-center group">
            <img src="/logo.png" alt="Contexto Claro" className="h-10 sm:h-11 w-auto group-hover:brightness-110 transition-all" />
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
            {navItems.map(item => (
              <button key={item.label} className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-accent transition-colors rounded-lg hover:bg-accent-muted">
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
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              />
              {searchFocused && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-strong rounded-xl overflow-hidden shadow-2xl z-50 max-h-80 overflow-y-auto fade-in">
                  {searching ? (
                    <div className="p-4 text-center text-xs text-text-muted pulse-soft">Buscando...</div>
                  ) : results.length > 0 ? (
                    results.map(item => (
                      <div key={item.id} className="p-3 hover:bg-accent-muted cursor-pointer border-b border-border last:border-0 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{item.country}</span>
                          <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{item.category}</span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                      </div>
                    ))
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
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(item => (
                <button key={item.label} className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:text-accent hover:bg-accent-muted rounded-lg transition-colors">
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
                    <NewsImage src={slide.image} alt={slide.title} news={slide} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
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
            <ScoreBadge score={score} size="sm" />
          </div>
          <div className="absolute bottom-3 left-3">
            <VerifiedPill veracity={news.veracity} />
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{news.country}</span>
            <span className="text-[11px] text-text-muted bg-surface px-1.5 py-0.5 rounded font-medium">
              {news.category?.split(' · ')[0] || news.category}
            </span>
          </div>
          <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2 font-heading group-hover:text-accent-light transition-colors">
            {news.title}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
            {news.description}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <GeminiBadge verdict={news.geminiVerdict} confidence={news.geminiConfidence} />
            </div>
            <span className="text-[11px] text-text-muted">{news.sourceCount ? `${news.sourceCount} fuentes` : ''}</span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === "compact") {
    return (
      <article
        className={`card overflow-hidden cursor-pointer group ${fakeRing}`}
        onClick={() => onSelectNews(news.id)}
      >
        <FakeBanner news={news} />
        <div className="relative h-36 overflow-hidden">
          <NewsImage src={news.image} alt={news.title} news={news} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          <div className="absolute top-2 right-2">
            <ScoreBadge score={score} size="sm" />
          </div>
        </div>
        <div className="p-3.5">
          <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-3 font-heading group-hover:text-accent-light transition-colors">
            {news.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">{news.sourceCount ? `${news.sourceCount} fuentes` : ''}</span>
            <GeminiBadge verdict={news.geminiVerdict} confidence={news.geminiConfidence} />
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-transparent" />
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

function MethodologyBanner() {
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
          <button className="shrink-0 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors shadow-lg shadow-accent/20">
            Conocer más
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════ STATS BAR ═══════════════ */

function StatsBar({ daily, feed, blindspot }) {
  const stats = [
    { label: 'Noticias hoy', value: daily.length + feed.length, icon: TrendingUp },
    { label: 'Fuentes analizadas', value: (daily.length + feed.length) * 5, icon: Eye },
    { label: 'Puntos ciegos', value: blindspot.length, icon: Compass },
  ]

  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-8">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="card p-4 text-center">
            <stat.icon size={18} className="text-accent mx-auto mb-2" />
            <p className="text-xl sm:text-2xl font-bold font-heading text-text-primary">{stat.value}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════ FOOTER ═══════════════ */

function Footer() {
  const columns = [
    { title: 'Explorar', links: ['Blindspot', 'Política', 'Economía', 'Verificador'] },
    { title: 'Países', links: ['Venezuela', 'Colombia'] },
    { title: 'Sobre nosotros', links: ['Metodología', 'Equipo', 'Contacto', 'Blog'] },
    { title: 'Legal', links: ['Privacidad', 'Términos', 'Cookies'] },
  ]

  return (
    <footer className="mt-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row justify-between gap-10">
          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1">
            {columns.map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-text-primary mb-4 font-heading">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-sm text-text-secondary hover:text-accent transition-colors">{link}</a>
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
              {[
                { label: 'X', href: '#' },
                { label: 'in', href: '#' },
                { label: 'ig', href: '#' },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:border-accent/40 hover:text-accent transition-all text-xs font-bold"
                >
                  {social.label}
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

/* ═══════════════ MAIN APP ═══════════════ */

export default function App() {
  const [selectedNewsId, setSelectedNewsId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('article')
    return id ? Number(id) : null
  })
  const [countryCode, setCountryCode] = useState('ALL')
  const handleCountryChange = (code) => { trackCountryFilter(code); setCountryCode(code) }
  const { hero, daily, blindspot, feed, flagged, sponsored, allNews, loading, error } = useNewsSections(countryCode)

  const scrollPosRef = useRef(0)

  const selectNews = useCallback((id) => {
    if (id) {
      // Save scroll position before navigating to article
      scrollPosRef.current = window.scrollY
      window.scrollTo({ top: 0 })
    }
    setSelectedNewsId(id)
    if (id) {
      window.history.pushState({ articleId: id, scrollY: scrollPosRef.current }, '', `?article=${id}`)
    } else {
      window.history.pushState({}, '', window.location.pathname)
    }
  }, [])

  const closeArticle = useCallback(() => {
    setSelectedNewsId(null)
    window.history.pushState({}, '', window.location.pathname)
    // Restore scroll position after React renders the feed
    const savedPos = scrollPosRef.current
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedPos })
    })
  }, [])

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.articleId) {
        setSelectedNewsId(event.state.articleId)
        window.scrollTo({ top: 0 })
      } else {
        setSelectedNewsId(null)
        // Restore scroll from saved state
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
        <Header onLogoClick={closeArticle} countryCode={countryCode} onCountryChange={handleCountryChange} />
        <ArticleView
          newsId={selectedNewsId}
          allNews={allNews}
          onClose={closeArticle}
          onSelectNews={selectNews}
        />
      </div>
    )
  }

  const topStories = feed.slice(0, 12)
  const investigations = [...daily, ...feed].filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i).slice(0, 8)

  return (
    <div className="gradient-bg" lang="es">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <Header onLogoClick={closeArticle} countryCode={countryCode} onCountryChange={handleCountryChange} />

      <main id="main-content" role="main" aria-label="Contenido principal" className="max-w-7xl mx-auto pb-8">
        {/* Hero Carousel */}
        <HeroSection news={hero} onSelectNews={selectNews} />

        {/* Stats Bar */}
        <StatsBar daily={daily} feed={feed} blindspot={blindspot} />

        {/* Resumen Diario */}
        {daily.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12 slide-up">
            <SectionHeader title="Resumen Diario" subtitle="Las noticias más relevantes de hoy" icon={TrendingUp} onSeeMore={() => {}} />
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
        <MethodologyBanner />

        {/* Top News Stories - Grid layout */}
        {topStories.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-12">
            <SectionHeader title="Noticias Principales" subtitle="Cobertura verificada de múltiples fuentes" icon={BarChart3} onSeeMore={() => {}} />
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
            <SectionHeader title="Investigaciones" subtitle="Análisis en profundidad" icon={Eye} onSeeMore={() => {}} />
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
            <SectionHeader title="Puntos Ciegos" subtitle="Noticias con cobertura desbalanceada" icon={Compass} onSeeMore={() => {}} />
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

      <Footer />
    </div>
  )
}
