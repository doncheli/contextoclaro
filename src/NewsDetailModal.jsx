import { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  CheckCircle, AlertOctagon,
  Eye, ArrowLeft, X, Compass, Newspaper, Info,
  Share2, ExternalLink, Copy, MessageCircle
} from 'lucide-react'
import { useArticleDetail } from './hooks/useNews'
import AdBanner from './components/AdBanner'
import CoverageMeter from './components/CoverageMeter'
import { trackRead } from './lib/consumptionTracker'
import NewsPoll from './components/NewsPoll'
import NewsTriptych from './components/NewsTriptych'
import { Comments } from '@hyvor/hyvor-talk-react'
import {
  trackArticleView, trackArticleTimeSpent, trackVerificationView,
  trackSourcesClick, trackReturnToFeed, observeScrollDepth, resetScrollTracking, trackShareClick
} from './lib/analytics'
import { getFallbackImage } from './lib/categoryImages'

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

const VERDICT_LABELS = { real: 'Verificada', misleading: 'Engañosa', fake: 'Falsa', unverified: 'Sin verificar' }
const VERDICT_EMOJI = { real: '✅', misleading: '⚠️', fake: '🚫', unverified: '❓' }

function ShareArticleButtons({ newsId, title, news, scores }) {
  const [copied, setCopied] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [feedback, setFeedback] = useState('')
  const panelRef = useRef(null)
  const btnRef = useRef(null)
  const slug = slugify(title || 'articulo')
  const url = `https://contextoclaro.com/noticia/${slug}-${newsId}`

  const verdict = news?.geminiVerdict || 'unverified'
  const vEmoji = VERDICT_EMOJI[verdict]
  const vLabel = VERDICT_LABELS[verdict]
  const score = scores ? Math.round((scores.factual * 0.35 + scores.sourceDiv * 0.25 + scores.transparency * 0.25 + scores.independence * 0.15)) : 0
  const scoreLabel = score >= 85 ? 'Muy fiable' : score >= 70 ? 'Fiable' : score >= 50 ? 'Precaución' : 'No fiable'
  const scoreColor = score >= 85 ? 'text-success' : score >= 70 ? 'text-accent' : score >= 50 ? 'text-warning' : 'text-danger'

  const shareText = `${vEmoji} ${title}\n\n${vLabel} · Puntuación: ${score}/100 · ${news?.sourceCount || 1} fuentes\n\nVerifica la noticia:`
  const encodedText = encodeURIComponent(shareText)
  const encodedUrl = encodeURIComponent(url)

  // Share via URL — uses location.href on mobile to avoid popup blocker
  const shareLink = (platform, shareUrl) => {
    trackShareClick(newsId, platform)
    setShowPanel(false)
    // Small delay to let panel close before navigation
    setTimeout(() => { window.open(shareUrl, '_blank') }, 100)
  }

  // Share via native share sheet (for platforms without share URL)
  const shareNative = (platform) => {
    trackShareClick(newsId, platform)
    setShowPanel(false)
    setTimeout(async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title, text: `${shareText}\n${url}`, url })
          return
        } catch {}
      }
      // Fallback: copy text
      try { await navigator.clipboard.writeText(`${shareText}\n${url}`) } catch {}
      setFeedback('Texto copiado — pégalo en tu publicación')
      setTimeout(() => setFeedback(''), 3000)
    }, 100)
  }

  const showFeedback = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000) }

  const copyLink = () => {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    trackShareClick(newsId, 'copy')
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (!showPanel) return
    const handler = (e) => { if (e.key === 'Escape') setShowPanel(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showPanel])

  const SOCIALS = [
    { name: 'X', color: 'hover:text-text-primary hover:bg-text-primary/10',
      action: () => shareLink('twitter', `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${vEmoji} ${title}\n\n${vLabel} · ${score}/100`)}&url=${encodedUrl}&via=contextoclaro`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { name: 'Facebook', color: 'hover:text-blue-600 hover:bg-blue-600/10',
      action: () => shareLink('facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
    { name: 'Instagram', color: 'hover:text-pink-500 hover:bg-pink-500/10',
      action: () => shareNative('instagram'),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
    { name: 'Threads', color: 'hover:text-text-primary hover:bg-text-primary/10',
      action: () => shareLink('threads', `https://www.threads.net/intent/post?text=${encodeURIComponent(`${vEmoji} ${title}\n\n${vLabel} · ${score}/100\n\n${url}`)}`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.751-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.17.408-2.243 1.33-3.023.81-.684 1.92-1.108 3.208-1.225.93-.085 1.785-.037 2.592.087-.078-.58-.244-1.044-.5-1.379-.376-.494-1.003-.756-1.812-.756h-.05c-.673.005-1.252.163-1.722.468l-.96-1.69c.71-.412 1.59-.64 2.606-.67h.084c1.358 0 2.413.46 3.058 1.333.467.631.757 1.45.862 2.414.51.168.986.374 1.426.622 1.14.641 2.006 1.538 2.503 2.6.764 1.63.834 4.34-1.31 6.44-1.794 1.76-4.012 2.528-7.155 2.553zM12.5 14c-.875 0-1.61.137-2.175.407-.483.23-.786.562-.81 1.12-.032.705.396 1.155.834 1.438.614.4 1.41.583 2.193.543 1.057-.057 1.862-.442 2.393-1.146.358-.473.603-1.095.72-1.87-.576-.195-1.262-.357-2.001-.42-.385-.04-.773-.062-1.154-.072z"/></svg> },
    { name: 'TikTok', color: 'hover:text-text-primary hover:bg-text-primary/10',
      action: () => shareNative('tiktok'),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
    { name: 'YouTube', color: 'hover:text-red-500 hover:bg-red-500/10',
      action: () => shareNative('youtube'),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
    { name: 'WhatsApp', color: 'hover:text-green-400 hover:bg-green-400/10',
      action: () => shareLink('whatsapp', `https://wa.me/?text=${encodedText}%20${encodedUrl}`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.122 1.525 5.853L.05 23.998l6.315-1.455A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.632-.507-5.145-1.387l-.37-.22-3.826.882.922-3.717-.242-.384A9.68 9.68 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg> },
    { name: 'Telegram', color: 'hover:text-blue-400 hover:bg-blue-400/10',
      action: () => shareLink('telegram', `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
    { name: 'LinkedIn', color: 'hover:text-blue-700 hover:bg-blue-700/10',
      action: () => shareLink('linkedin', `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`),
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  ]

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setShowPanel(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors border border-border hover:border-accent/30"
        aria-label="Compartir noticia" aria-expanded={showPanel}>
        <Share2 size={14} />
        <span className="hidden sm:inline">Compartir</span>
      </button>

      {showPanel && (
        <>
        {/* Overlay to close */}
        <div className="fixed inset-0 z-[99] bg-black/30" onClick={() => setShowPanel(false)} />
        <div ref={panelRef} className="share-panel" role="dialog" aria-modal="true" aria-label="Compartir noticia">
          {/* Close button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-text-secondary">Compartir noticia</span>
            <button onClick={() => setShowPanel(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          {/* Preview */}
          <div className="mb-4 p-3 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3 mb-2">
              {news?.image && <img src={news.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">{title}</p>
                <p className="text-[10px] text-text-muted mt-1">contextoclaro.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5"><span className={`text-sm font-black ${scoreColor}`}>{score}</span><span className="text-[10px] text-text-muted">{scoreLabel}</span></div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1"><span className="text-sm">{vEmoji}</span><span className="text-[10px] font-semibold text-text-secondary">{vLabel}</span></div>
              <div className="w-px h-4 bg-border" />
              <span className="text-[10px] text-text-muted">{news?.sourceCount || 1} fuentes</span>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="mb-3 p-2.5 rounded-xl bg-success/10 border border-success/30 flex items-center gap-2">
              <CheckCircle size={14} className="text-success shrink-0" />
              <span className="text-[11px] text-success font-medium">{feedback}</span>
            </div>
          )}

          {/* Social grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {SOCIALS.map(s => (
              <button key={s.name} onClick={s.action}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border text-text-muted transition-all ${s.color}`} title={s.name}>
                {s.icon}
                <span className="text-[10px] font-medium">{s.name}</span>
              </button>
            ))}
          </div>

          {/* Copy link */}
          <button onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:border-accent/30 hover:text-accent transition-colors">
            {copied ? <CheckCircle size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
          </button>
        </div>
        </>
      )}
    </div>
  )
}

function NewsImage({ src, alt, className = "", news }) {
  const [failed, setFailed] = useState(false)
  const fallback = news ? getFallbackImage(news) : null

  if ((!src || failed) && fallback) {
    return <img src={fallback} alt={alt} className={className} loading="lazy" decoding="async" />
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
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.color} bg-surface`}>
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
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
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
              <circle cx={70} cy={70} r={56} fill="none" className="stroke-gray-200" strokeWidth="10" />
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
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-300 mb-3 shadow-inner border border-gray-300">
              <div className="bg-red-600 bar-animate" style={{ width: `${bias.left}%` }} />
              <div className="bg-white bar-animate" style={{ width: `${bias.center}%` }} />
              <div className="bg-[#1b4f72] bar-animate" style={{ width: `${bias.right}%` }} />
            </div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span className="text-red-600">Izquierda<br /><span className="text-sm font-bold">{bias.left}%</span></span>
              <span className="text-gray-500 text-center">Centro<br /><span className="text-sm font-bold">{bias.center}%</span></span>
              <span className="text-[#1b4f72] text-right">Derecha<br /><span className="text-sm font-bold">{bias.right}%</span></span>
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

        {/* Coverage Meter */}
        <div className="mb-5">
          <CoverageMeter sourceCount={sourceCount} bias={bias} variant="full" />
        </div>

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
        <div className="h-1.5 rounded-full overflow-hidden bg-gray-200 mb-3">
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
    "izquierda": "text-red-600 border-red-300 bg-red-50",
    "centro-izquierda": "text-red-500 border-red-200 bg-red-50/50",
    "centro": "text-gray-600 border-gray-300 bg-gray-100",
    "centro-derecha": "text-[#1b4f72] border-blue-200 bg-blue-50/50",
    "derecha": "text-[#1b4f72] border-blue-300 bg-blue-50"
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
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
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

  // Update URL slug and page title when article is available
  useEffect(() => {
    if (!news?.title) return
    const expectedPath = `/noticia/${slugify(news.title)}-${newsId}`
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(window.history.state, '', expectedPath)
    }
    document.title = `${news.title} — Contexto Claro`
    return () => { document.title = 'Contexto Claro · Noticias verificadas' }
  }, [news?.title, newsId])

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Track consumption for personal bias dashboard
  useEffect(() => {
    if (news) trackRead(news)
  }, [news?.id])

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
      <div className="min-h-[60vh] flex items-center justify-center" aria-live="polite">
        <div className="flex flex-col items-center gap-3 fade-in">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center pulse-soft">
            <Compass size={20} className="text-accent" aria-hidden="true" />
          </div>
          <span className="text-sm text-text-muted" role="status">Cargando artículo...</span>
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
          aria-label="Volver"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors mb-4 group"
        >
          <ArrowLeft size={16} aria-hidden="true" className="group-hover:-translate-x-0.5 transition-transform" /> Volver
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

            {/* Meta: source, date, read time, share */}
            <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-text-muted">
              <span className="font-medium text-text-primary">{news.sourceLabel}</span>
              <span>·</span>
              <span>{news.publishedAt ? new Date(news.publishedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span>·</span>
              <span>{Math.max(1, Math.round((detail.body?.length || 1) * 50 / 200))} min de lectura</span>
              <div className="ml-auto flex items-center gap-1">
                <ShareArticleButtons newsId={newsId} title={news.title} news={news} scores={detail.scores} />
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

        {/* Poll — user vote before seeing AI verdict */}
        <NewsPoll newsId={newsId} geminiVerdict={news.geminiVerdict} geminiConfidence={news.geminiConfidence} />

        {/* News Triptych — perspective comparison */}
        <NewsTriptych sources={detail.sources} />

        {/* Comments — Hyvor Talk */}
        {import.meta.env.VITE_HYVOR_WEBSITE_ID && (
          <section className="mt-8">
            <h2 className="text-lg font-bold font-heading mb-4">Comentarios</h2>
            <Comments
              website-id={Number(import.meta.env.VITE_HYVOR_WEBSITE_ID)}
              page-id={`news-${newsId}`}
              page-title={news.title}
              page-language="es"
              colors="dark"
              loading="lazy"
            />
          </section>
        )}

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
