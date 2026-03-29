import { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  CheckCircle, AlertOctagon,
  Eye, ArrowLeft, X, Compass, Newspaper, Info
} from 'lucide-react'
import { useArticleDetail } from './hooks/useNews'
import AdBanner from './components/AdBanner'
import {
  trackArticleView, trackArticleTimeSpent, trackVerificationView,
  trackSourcesClick, trackReturnToFeed, observeScrollDepth, resetScrollTracking
} from './lib/analytics'
import { getFallbackImage } from './lib/categoryImages'

function NewsImage({ src, alt, className = "", news }) {
  const [failed, setFailed] = useState(false)
  const fallback = news ? getFallbackImage(news) : null

  if ((!src || failed) && fallback) {
    return <img src={fallback} alt={alt} className={className} loading="lazy" />
  }

  if (!src || failed) {
    return (
      <div className={`bg-gradient-to-br from-surface to-card flex items-center justify-center ${className}`}>
        <Newspaper size={40} className="text-text-muted/40" />
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

/* ── Score helpers ── */
function computeOverallScore(scores) {
  if (!scores) return 0
  return Math.round((scores.factual * 0.35 + scores.sourceDiv * 0.25 + scores.transparency * 0.25 + scores.independence * 0.15))
}

function getScoreColor(score) {
  if (score >= 85) return { text: 'text-success', bg: 'bg-success', label: 'MUY FIABLE' }
  if (score >= 70) return { text: 'text-accent', bg: 'bg-accent', label: 'FIABLE' }
  if (score >= 50) return { text: 'text-warning', bg: 'bg-warning', label: 'PRECAUCIÓN' }
  return { text: 'text-danger', bg: 'bg-danger', label: 'NO FIABLE' }
}

/* ── Tooltip ── */
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="tooltip-bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}

/* ── AI Validation Section ── */
function AIValidationSection({ news }) {
  if (!news?.geminiVerdict) return null
  const config = {
    real: { icon: ShieldCheck, color: 'text-success', bg: 'from-success/10 to-success/5', border: 'border-success/30', glow: 'shadow-success/10', label: 'NOTICIA REAL' },
    misleading: { icon: ShieldAlert, color: 'text-warning', bg: 'from-warning/10 to-warning/5', border: 'border-warning/30', glow: 'shadow-warning/10', label: 'ENGAÑOSA' },
    fake: { icon: ShieldX, color: 'text-danger', bg: 'from-danger/10 to-danger/5', border: 'border-danger/30', glow: 'shadow-danger/10', label: 'FALSA' },
    unverified: { icon: ShieldQuestion, color: 'text-text-muted', bg: 'from-surface to-base', border: 'border-border', glow: '', label: 'SIN VERIFICAR' },
  }
  const c = config[news.geminiVerdict] || config.unverified
  const Icon = c.icon
  return (
    <div className={`rounded-xl p-4 border-2 ${c.border} bg-gradient-to-br ${c.bg} mb-5 shadow-lg ${c.glow}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.color} bg-white/5`}>
          <Icon size={16} />
        </div>
        <span className={`text-[11px] font-bold tracking-wider ${c.color}`}>VALIDACIÓN IA</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-xl font-black font-heading ${c.color}`}>{c.label}</span>
        {news.geminiConfidence > 0 && (
          <span className="text-[11px] text-text-muted font-medium">({news.geminiConfidence}%)</span>
        )}
      </div>
      {news.geminiReasoning && (
        <p className="text-xs text-text-primary/80 leading-relaxed">{news.geminiReasoning}</p>
      )}
    </div>
  )
}

/* ── Score Detail Bar with Tooltip ── */
const SCORE_TOOLTIPS = {
  'Precisión factual': 'Mide qué tan precisa y verificable es la información presentada. Se evalúa contra fuentes oficiales y datos comprobables.',
  'Diversidad de fuentes': 'Indica cuántas fuentes diferentes cubren esta noticia. Mayor diversidad = mayor confiabilidad.',
  'Transparencia': 'Evalúa si la fuente identifica claramente al autor, cita fuentes y distingue opinión de información.',
  'Independencia': 'Mide si la cobertura es equilibrada o si favorece una postura política o comercial específica.',
}

function ScoreDetailBar({ label, value, color }) {
  const tooltip = SCORE_TOOLTIPS[label]
  const bgColor = color === 'text-success' ? 'bg-success' : color === 'text-accent' ? 'bg-accent' : color === 'text-warning' ? 'bg-warning' : 'bg-danger'
  return (
    <div className="mb-4 group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-primary font-medium">{label}</span>
          {tooltip && (
            <Tooltip text={tooltip}>
              <Info size={12} className="text-text-muted/50 hover:text-accent cursor-help transition-colors" aria-hidden="true" />
            </Tooltip>
          )}
        </div>
        <span className={`text-xs font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-base/80 overflow-hidden">
        <div className={`h-full rounded-full ${bgColor} bar-animate transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

/* ── Verificador Sidebar ── */
function VerificadorSidebar({ overall, sc, r, circ, offset, bias, sourceCount, onShowSources, news, scores }) {
  return (
    <aside className="w-full lg:w-[340px] shrink-0" aria-label="Panel de verificación">
      <div className="verificador-sidebar sticky top-24 rounded-2xl p-6 border border-accent/15">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center shadow-md shadow-accent/5">
            <ShieldCheck size={20} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-heading text-text-primary">Verificador</h3>
            <span className="text-[10px] text-text-muted">Análisis automatizado por IA</span>
          </div>
        </div>

        {/* AI validation */}
        <AIValidationSection news={news} />

        {/* Circular gauge */}
        <div className="flex flex-col items-center mb-6 py-3 mx-auto">
          <div className="relative flex items-center justify-center">
            <svg width={140} height={140} className="transform -rotate-90" aria-hidden="true">
              <circle cx={70} cy={70} r={56} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
              <circle cx={70} cy={70} r={56} fill="none"
                strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 56} strokeDashoffset={2 * Math.PI * 56 - (overall / 100) * 2 * Math.PI * 56}
                className={`stroke-current ${sc.text} ring-animate`}
                style={{ filter: `drop-shadow(0 0 6px currentColor)` }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-black font-heading ${sc.text}`} style={{ textShadow: '0 0 20px currentColor' }}>{overall}</span>
              <span className="text-[10px] text-text-muted font-medium">/ 100</span>
            </div>
          </div>
          <span className={`text-sm font-bold ${sc.text} mt-3 tracking-wide`}>{sc.label}</span>
          <span className="text-[10px] text-text-muted mt-0.5">Puntuación de confiabilidad</span>
        </div>

        {/* Score breakdown */}
        {scores && (
          <div className="mb-5 pb-5 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-text-primary tracking-wide uppercase">Desglose</span>
              <Tooltip text="Cada métrica se calcula automáticamente analizando la noticia, sus fuentes y su contexto.">
                <Info size={12} className="text-text-muted/50 hover:text-accent cursor-help transition-colors" aria-hidden="true" />
              </Tooltip>
            </div>
            <ScoreDetailBar label="Precisión factual" value={scores.factual} color={getScoreColor(scores.factual).text} />
            <ScoreDetailBar label="Diversidad de fuentes" value={scores.sourceDiv} color={getScoreColor(scores.sourceDiv).text} />
            <ScoreDetailBar label="Transparencia" value={scores.transparency} color={getScoreColor(scores.transparency).text} />
            <ScoreDetailBar label="Independencia" value={scores.independence} color={getScoreColor(scores.independence).text} />
          </div>
        )}

        {/* Bias spectrum */}
        {bias && (
          <div className="mb-5 pb-5 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-text-primary tracking-wide uppercase">Espectro de Sesgo</span>
              <Tooltip text="Distribución del sesgo político de las fuentes que cubren esta noticia. Un balance equilibrado indica cobertura más objetiva.">
                <Info size={12} className="text-text-muted/50 hover:text-accent cursor-help transition-colors" aria-hidden="true" />
              </Tooltip>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-base/60 mb-3 shadow-inner">
              <div className="bg-bias-left bar-animate" style={{ width: `${bias.left}%` }} />
              <div className="bg-bias-center bar-animate" style={{ width: `${bias.center}%` }} />
              <div className="bg-bias-right bar-animate" style={{ width: `${bias.right}%` }} />
            </div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span className="text-bias-left">Izquierda<br /><span className="text-sm font-bold">{bias.left}%</span></span>
              <span className="text-bias-center text-center">Centro<br /><span className="text-sm font-bold">{bias.center}%</span></span>
              <span className="text-bias-right text-right">Derecha<br /><span className="text-sm font-bold">{bias.right}%</span></span>
            </div>
          </div>
        )}

        {/* Source info */}
        {news.source && (
          <div className="mb-4 p-3 rounded-lg bg-surface/80 border border-border">
            <span className="text-[10px] text-text-muted uppercase tracking-wide font-bold block mb-1">Fuente principal</span>
            <span className="text-sm font-semibold text-text-primary">{news.source}</span>
            {news.credibility && (
              <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                news.credibility === 'alta' ? 'bg-success/15 text-success' :
                news.credibility === 'media' ? 'bg-warning/15 text-warning' :
                'bg-danger/15 text-danger'
              }`}>
                {news.credibility.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Sources button */}
        {sourceCount > 0 && (
          <button
            onClick={onShowSources}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
          >
            <Eye size={15} aria-hidden="true" /> Ver {sourceCount} fuentes verificadas
          </button>
        )}
      </div>
    </aside>
  )
}

/* ── Regional Context Cards ── */
function RegionalContextCard({ news, onClick }) {
  const factCheck = news.credibility === 'alta' ? 75 : news.credibility === 'media' ? 60 : 50
  const biasScore = news.bias ? news.bias.left + news.bias.center : 50

  const flagNames = { '🇻🇪': 'VENEZUELA', '🇨🇴': 'COLOMBIA' }
  const countryName = flagNames[news.country] || news.category

  const factCheckColor = factCheck >= 70 ? 'text-success' : factCheck >= 50 ? 'text-warning' : 'text-danger'
  const biasBarColor = biasScore >= 70 ? 'bg-success' : biasScore >= 50 ? 'bg-warning' : 'bg-danger'

  return (
    <div
      className="min-w-[220px] max-w-[240px] card overflow-hidden cursor-pointer shrink-0 group"
      onClick={() => onClick(news.id)}
    >
      {/* Flag banner */}
      <div className="h-20 bg-gradient-to-br from-accent/20 to-accent-muted flex items-center justify-center">
        <span className="text-4xl">{news.country}</span>
      </div>

      <div className="p-4">
        <div className="mb-2">
          <span className="text-xs font-bold text-text-primary block font-heading">{countryName}</span>
          <span className={`text-[10px] font-semibold ${factCheckColor}`}>
            Verificación: {factCheck}%
          </span>
        </div>

        <h4 className="text-sm font-semibold leading-snug mb-3 line-clamp-3 group-hover:text-accent-light transition-colors">
          {news.title}
        </h4>

        {/* Bias bar */}
        <div className="h-1.5 rounded-full overflow-hidden bg-base mb-3">
          <div className={`h-full rounded-full ${biasBarColor}`} style={{ width: `${biasScore}%` }} />
        </div>

        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>Sesgo: {biasScore}</span>
          <span>{news.sourceCount || 5} Fuentes</span>
        </div>
      </div>
    </div>
  )
}

function RegionalContext({ allNews, currentNewsId, onSelectNews }) {
  const regionalNews = allNews
    .filter(n => n.id !== currentNewsId && n.country)
    .slice(0, 8)

  if (regionalNews.length === 0) return null

  return (
    <section className="mt-12 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center">
          <Compass size={18} className="text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold font-heading">Contexto Regional</h2>
          <p className="text-xs text-text-muted">Cómo se cubre esta historia en otros países</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {regionalNews.map(news => (
          <RegionalContextCard key={news.id} news={news} onClick={onSelectNews} />
        ))}
      </div>
    </section>
  )
}

/* ── Sources Panel ── */
function SourcesPanel({ sources, isOpen, onClose }) {
  if (!isOpen || !sources?.length) return null

  const biasColors = {
    "izquierda": "text-bias-left border-bias-left/30 bg-bias-left/10",
    "centro-izquierda": "text-bias-left border-bias-left/20 bg-bias-left/5",
    "centro": "text-bias-center border-bias-center/30 bg-bias-center/10",
    "centro-derecha": "text-bias-right border-bias-right/20 bg-bias-right/5",
    "derecha": "text-bias-right border-bias-right/30 bg-bias-right/10"
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Fuentes verificadas" onClick={onClose}>
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" />
      <div className="relative glass-strong rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold font-heading flex items-center gap-2">
            <Eye size={18} className="text-accent" aria-hidden="true" />
            Fuentes Verificadas
          </h3>
          <button onClick={onClose} aria-label="Cerrar panel de fuentes" className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          {sources.map((src, i) => {
            const srcSc = getScoreColor(src.credibility || 70)
            return (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{src.name}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${biasColors[src.bias] || biasColors.centro}`}>
                    {src.bias?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mb-2">{src.stance}</p>
                {src.credibility && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-base overflow-hidden">
                      <div className={`h-full rounded-full ${srcSc.bg}`} style={{ width: `${src.credibility}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${srcSc.text}`}>{src.credibility}/100</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ ARTICLE VIEW ═══════════════ */

export default function ArticleView({ newsId, allNews, onClose, onSelectNews }) {
  const [showSources, setShowSources] = useState(false)
  const startTimeRef = useRef(Date.now())

  const newsFromList = allNews.find(n => n.id === newsId)
  const { data: detail, loading, error } = useArticleDetail(newsId)

  // Use detail.news as fallback when article isn't in the preloaded list
  const news = newsFromList || (detail ? detail.news : null)

  // Track article view + scroll depth + time spent
  useEffect(() => {
    if (!news) return
    trackArticleView(news)
    resetScrollTracking()
    startTimeRef.current = Date.now()
    const cleanupScroll = observeScrollDepth(newsId, document.documentElement)

    if (news.geminiVerdict) {
      trackVerificationView(newsId, news.geminiVerdict, news.geminiConfidence)
    }

    return () => {
      cleanupScroll()
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000)
      trackArticleTimeSpent(newsId, seconds)
    }
  }, [newsId, news?.id])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 fade-in">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center pulse-soft">
            <Compass size={20} className="text-accent" />
          </div>
          <span className="text-sm text-text-muted">Cargando artículo...</span>
        </div>
      </div>
    )
  }

  if (error || !detail || !news) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center fade-in">
          <AlertOctagon size={32} className="text-danger mx-auto mb-3" />
          <p className="text-sm text-text-secondary mb-4">No se pudo cargar el artículo</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-surface border border-border text-sm hover:border-border-hover transition-colors">
            Volver
          </button>
        </div>
      </div>
    )
  }

  const overall = computeOverallScore(detail.scores)
  const sc = getScoreColor(overall)
  const r = 48
  const circ = 2 * Math.PI * r
  const offset = circ - (overall / 100) * circ

  return (
    <div className="min-h-screen">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button
          onClick={() => { trackReturnToFeed(newsId); onClose() }}
          aria-label="Volver al inicio"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors mb-4 group"
        >
          <ArrowLeft size={16} aria-hidden="true" className="group-hover:-translate-x-0.5 transition-transform" /> Volver al inicio
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left column: Hero + Article */}
          <div className="flex-1 min-w-0 slide-up">
            {/* Hero image with overlaid title */}
            <div className="relative rounded-2xl overflow-hidden mb-8">
              <NewsImage src={news.image} alt={`Imagen de la noticia: ${news.title}`} className="w-full h-[300px] sm:h-[400px] object-cover" news={news} />
              <div className="absolute inset-0 img-overlay" />

              {/* Category + flag overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="inline-block px-3 py-1 rounded-lg text-[11px] font-bold tracking-wide bg-base/70 text-text-primary backdrop-blur-sm border border-border">
                  {news.category}
                </span>
                <span className="text-2xl">{news.country}</span>
              </div>

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight font-heading">
                  {news.title}
                </h1>
                {news.description && (
                  <p className="text-sm text-text-secondary mt-2 line-clamp-2 max-w-2xl">{news.description}</p>
                )}
              </div>
            </div>

            {/* Article body */}
            <article className="article-body mb-8" role="article" aria-label={news.title}>
              {detail.body.length > 0 ? (
                detail.body.map((para, i) => (
                  <div key={i}>
                    <p className="text-sm sm:text-base text-text-primary/90 leading-relaxed mb-5">
                      {para}
                    </p>
                    {/* Ad every 4 paragraphs, only if article is long enough */}
                    {(i + 1) % 4 === 0 && i < detail.body.length - 1 && detail.body.length >= 6 && (
                      <AdBanner variant="article-inline" />
                    )}
                  </div>
                ))
              ) : (
                <div className="card p-6 text-center">
                  <Newspaper size={32} className="text-accent/40 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-text-secondary mb-2">
                    El contenido completo de esta noticia no está disponible.
                  </p>
                  <p className="text-xs text-text-muted">
                    Fuente: <span className="font-semibold text-text-secondary">{news.source || news.category}</span>
                  </p>
                </div>
              )}
            </article>
          </div>

          {/* Right column: Verificador sidebar + Ad */}
          <div className="w-full lg:w-[340px] shrink-0 space-y-4">
          <VerificadorSidebar
            overall={overall}
            sc={sc}
            r={r}
            circ={circ}
            offset={offset}
            bias={news.bias}
            sourceCount={detail.sources?.length || news.sourceCount || 0}
            onShowSources={() => { trackSourcesClick(newsId, detail.sources?.length || 0); setShowSources(true) }}
            news={news}
            scores={detail.scores}
          />
          <AdBanner variant="sidebar" />
          </div>
        </div>

        {/* Regional Context */}
        <RegionalContext
          allNews={allNews}
          currentNewsId={newsId}
          onSelectNews={(id) => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            if (onSelectNews) onSelectNews(id)
          }}
        />
      </div>

      {/* Sources panel */}
      <SourcesPanel sources={detail.sources} isOpen={showSources} onClose={() => setShowSources(false)} />
    </div>
  )
}
