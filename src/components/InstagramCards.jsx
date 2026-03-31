import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

function mapRow(r) {
  return {
    id: r.id, title: r.title, source: r.source_label, country: r.country,
    image: r.image, verdict: r.gemini_verdict, confidence: r.gemini_confidence,
    reasoning: r.gemini_reasoning,
    scoreFactual: r.score_factual, sourceDiv: r.score_source_div,
    transparency: r.score_transparency, independence: r.score_independence,
    biasLeft: r.bias_left, biasCenter: r.bias_center, biasRight: r.bias_right,
    sourceCount: r.source_count, sponsored: r.sponsored_flag,
  }
}

function score(n) {
  return Math.round(n.scoreFactual * 0.35 + n.sourceDiv * 0.25 + n.transparency * 0.25 + n.independence * 0.15)
}

const V = {
  real: { icon: ShieldCheck, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'REAL', emoji: '✅' },
  misleading: { icon: ShieldAlert, color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'ENGAÑOSA', emoji: '⚠️' },
  fake: { icon: ShieldX, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'FALSA', emoji: '🚨' },
  unverified: { icon: ShieldQuestion, color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: 'SIN VERIFICAR', emoji: '❓' },
}

// ── Card Style 1: Bold verdict with score ──
function CardStyle1({ news }) {
  const s = score(news)
  const v = V[news.verdict] || V.unverified
  const scoreColor = s >= 80 ? '#059669' : s >= 60 ? '#1b4f72' : s >= 40 ? '#d97706' : '#dc2626'
  return (
    <div className="w-[1080px] h-[1080px] bg-white relative overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top accent bar */}
      <div className="h-2 w-full" style={{ background: v.color }} />

      {/* Header */}
      <div className="flex items-center justify-between px-16 pt-10 pb-6">
        <img src="/logo.png" alt="" className="h-12" />
        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl" style={{ background: v.bg, border: `2px solid ${v.border}` }}>
          <span className="text-2xl">{v.emoji}</span>
          <span className="text-xl font-black tracking-wider" style={{ color: v.color }}>{v.label}</span>
        </div>
      </div>

      {/* Image */}
      {news.image && (
        <div className="mx-16 h-[350px] rounded-2xl overflow-hidden relative">
          <img src={news.image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-5 flex items-center gap-2">
            <span className="text-3xl">{news.country}</span>
            <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white/20 text-white backdrop-blur-sm">{news.source}</span>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="px-16 pt-6">
        <h1 className="text-[30px] font-extrabold leading-[1.2] text-[#1a2a3a] line-clamp-2">{news.title}</h1>
      </div>

      {/* Score ring + label — BIG */}
      <div className="px-16 pt-5 flex items-center gap-6">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <svg width={120} height={120} className="transform -rotate-90">
            <circle cx={60} cy={60} r={50} fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle cx={60} cy={60} r={50} fill="none" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2*Math.PI*50} strokeDashoffset={2*Math.PI*50-(s/100)*2*Math.PI*50} stroke={scoreColor} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[36px] font-black leading-none" style={{ color: scoreColor }}>{s}</span>
            <span className="text-[10px] text-[#9ca3af]">/100</span>
          </div>
        </div>
        <div className="flex-1">
          <span className="text-lg font-black text-[#1a2a3a] block" style={{ color: scoreColor }}>
            {s >= 85 ? 'MUY FIABLE' : s >= 70 ? 'FIABLE' : s >= 50 ? 'PRECAUCIÓN' : 'NO FIABLE'}
          </span>
          <span className="text-sm text-[#6b8299] block mt-1">Confianza IA: {news.confidence}%</span>
          <span className="text-sm text-[#6b8299]">{news.sourceCount || 1} fuentes verificadas</span>
        </div>
      </div>

      {/* Bias bar — BIG */}
      <div className="px-16 pt-5">
        <span className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider block mb-2">Espectro de sesgo</span>
        <div className="flex h-7 rounded-full overflow-hidden border-2 border-gray-300">
          {news.biasLeft > 0 && <div className="bg-red-500 flex items-center justify-center" style={{ width: `${news.biasLeft}%` }}>
            {news.biasLeft > 15 && <span className="text-[11px] font-bold text-white">{news.biasLeft}%</span>}
          </div>}
          {news.biasCenter > 0 && <div className="bg-gray-100 flex items-center justify-center border-x border-gray-300" style={{ width: `${news.biasCenter}%` }}>
            {news.biasCenter > 15 && <span className="text-[11px] font-bold text-gray-500">{news.biasCenter}%</span>}
          </div>}
          {news.biasRight > 0 && <div className="bg-[#1b4f72] flex items-center justify-center" style={{ width: `${news.biasRight}%` }}>
            {news.biasRight > 15 && <span className="text-[11px] font-bold text-white">{news.biasRight}%</span>}
          </div>}
        </div>
        <div className="flex justify-between text-[12px] font-bold mt-2">
          <span className="text-red-500">◀ Izquierda</span>
          <span className="text-gray-400">Centro</span>
          <span className="text-[#1b4f72]">Derecha ▶</span>
        </div>
      </div>

      {/* Perspective mini triptych */}
      <div className="px-16 pt-4 pb-5 flex gap-3">
        {[
          { label: 'Izquierda', pct: news.biasLeft, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Centro', pct: news.biasCenter, color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
          { label: 'Derecha', pct: news.biasRight, color: '#1b4f72', bg: '#eff6ff', border: '#bfdbfe' },
        ].map((p, i) => (
          <div key={i} className="flex-1 rounded-xl p-3 text-center" style={{ background: p.bg, border: `1.5px solid ${p.border}` }}>
            <span className="text-[22px] font-black block leading-none" style={{ color: p.color }}>{p.pct}%</span>
            <span className="text-[10px] font-semibold mt-1 block" style={{ color: p.color }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-16 py-4 flex items-center justify-between" style={{ background: '#1b4f72' }}>
        <span className="text-white text-sm font-bold">contextoclaro.com</span>
        <span className="text-[#2bb5b2] text-xs font-semibold">Filtramos el ruido. Entregamos la verdad.</span>
        <span className="text-white/60 text-xs">@don_cheli</span>
      </div>
    </div>
  )
}

// ── Card Style 2: Dark dramatic ──
function CardStyle2({ news }) {
  const s = score(news)
  const v = V[news.verdict] || V.unverified
  return (
    <div className="w-[1080px] h-[1080px] bg-[#0f1923] relative overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Background image with heavy overlay */}
      {news.image && (
        <div className="absolute inset-0">
          <img src={news.image} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1923]/80 via-[#0f1923]/90 to-[#0f1923]" />
        </div>
      )}

      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-16 pt-12">
          <img src="/logo.png" alt="" className="h-11 brightness-0 invert" />
          <span className="text-white/40 text-sm">{news.country} {news.source}</span>
        </div>

        {/* Verdict big */}
        <div className="px-16 pt-12">
          <span className="text-[80px] leading-none font-black tracking-tight" style={{ color: v.color }}>{v.emoji} {v.label}</span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-white/50 text-lg">{news.confidence}% confianza</span>
            <span className="text-white/30">·</span>
            <span className="text-white/50 text-lg">Score {s}/100</span>
          </div>
        </div>

        {/* Title */}
        <div className="px-16 pt-10 flex-1">
          <h1 className="text-[36px] font-extrabold leading-[1.2] text-white line-clamp-4">{news.title}</h1>
        </div>

        {/* Reasoning */}
        {news.reasoning && (
          <div className="px-16 pb-6">
            <p className="text-white/50 text-base leading-relaxed line-clamp-2">{news.reasoning.split('|')[0].trim()}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-16 py-6 flex items-center justify-between border-t border-white/10">
          <span className="text-white/80 text-sm font-bold">contextoclaro.com</span>
          <span className="text-[#2bb5b2] text-xs font-semibold">Filtramos el ruido. Entregamos la verdad.</span>
          <span className="text-white/40 text-xs">@don_cheli</span>
        </div>
      </div>
    </div>
  )
}

// ── Card Style 3: Clean infographic ──
function CardStyle3({ news }) {
  const s = score(news)
  const v = V[news.verdict] || V.unverified
  const scoreColor = s >= 80 ? '#059669' : s >= 60 ? '#1b4f72' : s >= 40 ? '#d97706' : '#dc2626'
  const metrics = [
    { label: 'Factual', value: news.scoreFactual, color: '#059669' },
    { label: 'Fuentes', value: news.sourceDiv, color: '#1b4f72' },
    { label: 'Transparencia', value: news.transparency, color: '#d97706' },
    { label: 'Independencia', value: news.independence, color: '#7c3aed' },
  ]
  return (
    <div className="w-[1080px] h-[1080px] bg-[#f8fafc] relative overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-16 pt-10 pb-6 border-b border-gray-200">
        <img src="/logo.png" alt="" className="h-11" />
        <div className="text-right">
          <span className="text-xs text-[#6b8299] block">{news.country} {news.source}</span>
          <span className="text-xs text-[#6b8299]">{news.sourceCount || 1} fuentes verificadas</span>
        </div>
      </div>

      {/* Verdict + Title */}
      <div className="px-16 pt-8">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl mb-5" style={{ background: v.bg, border: `2px solid ${v.border}` }}>
          <span className="text-lg">{v.emoji}</span>
          <span className="text-base font-black tracking-wider" style={{ color: v.color }}>{v.label}</span>
          <span className="text-sm font-bold opacity-60" style={{ color: v.color }}>({news.confidence}%)</span>
        </div>
        <h1 className="text-[30px] font-extrabold leading-[1.25] text-[#1a2a3a] line-clamp-3">{news.title}</h1>
      </div>

      {/* Metrics grid */}
      <div className="px-16 pt-8 grid grid-cols-2 gap-4 flex-1">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#6b8299]">{m.label}</span>
              <span className="text-xl font-black" style={{ color: m.color }}>{m.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Score + Bias */}
      <div className="px-16 py-6 flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center" style={{ borderColor: scoreColor }}>
            <span className="text-xl font-black" style={{ color: scoreColor }}>{s}</span>
          </div>
          <span className="text-sm font-bold text-[#1a2a3a]">Score<br/>general</span>
        </div>
        <div className="flex-1">
          <div className="flex h-3 rounded-full overflow-hidden border border-gray-300">
            {news.biasLeft > 0 && <div className="bg-red-500" style={{ width: `${news.biasLeft}%` }} />}
            {news.biasCenter > 0 && <div className="bg-gray-200" style={{ width: `${news.biasCenter}%` }} />}
            {news.biasRight > 0 && <div className="bg-[#1b4f72]" style={{ width: `${news.biasRight}%` }} />}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-16 py-5 flex items-center justify-between" style={{ background: '#1b4f72' }}>
        <span className="text-white text-sm font-bold">contextoclaro.com</span>
        <span className="text-[#2bb5b2] text-xs">Filtramos el ruido. Entregamos la verdad.</span>
        <span className="text-white/60 text-xs">@don_cheli</span>
      </div>
    </div>
  )
}

const STYLES = [CardStyle1, CardStyle2, CardStyle3]
const STYLE_NAMES = ['Clásico', 'Dramático', 'Infográfico']

export default function InstagramCardsPage() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStyle, setSelectedStyle] = useState(0)
  const [selectedNews, setSelectedNews] = useState(0)

  useEffect(() => {
    supabase.from('news').select('*')
      .in('country_code', ['VE', 'CO', 'TECH'])
      .not('gemini_verdict', 'is', null)
      .order('published_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { setNews((data || []).map(mapRow)); setLoading(false) })
  }, [])

  if (loading) return <div className="text-center py-20 text-sm text-text-muted">Cargando noticias...</div>
  if (news.length === 0) return <div className="text-center py-20 text-sm text-text-muted">No hay noticias disponibles</div>

  const CardComponent = STYLES[selectedStyle]
  const currentNews = news[selectedNews]

  return (
    <div>
      {/* Style selector */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-bold text-text-primary">Estilo:</span>
        {STYLE_NAMES.map((name, i) => (
          <button key={i} onClick={() => setSelectedStyle(i)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedStyle === i ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-accent/50'}`}>
            {name}
          </button>
        ))}
      </div>

      {/* News selector */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-bold text-text-primary">Noticia:</span>
        <button onClick={() => setSelectedNews(Math.max(0, selectedNews - 1))} className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-text-secondary">{selectedNews + 1} de {news.length}</span>
        <button onClick={() => setSelectedNews(Math.min(news.length - 1, selectedNews + 1))} className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Preview (scaled down) */}
      <div className="border border-border rounded-2xl overflow-hidden" style={{ width: '540px', height: '540px' }}>
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}>
          <CardComponent news={currentNews} />
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 text-xs text-text-muted">
        <p>Tamaño real: 1080×1080px · Formato: Instagram Feed / Stories</p>
        <p className="mt-1">URL directa: <a href={`/social-card?id=${currentNews.id}&style=${selectedStyle}`} className="text-accent hover:underline" target="_blank">contextoclaro.com/social-card?id={currentNews.id}&style={selectedStyle}</a></p>
      </div>
    </div>
  )
}
