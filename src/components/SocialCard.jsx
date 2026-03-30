import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'
import { supabase } from '../lib/supabase'

function mapRow(r) {
  return {
    id: r.id, title: r.title, description: r.description, source: r.source_label,
    country: r.country, category: r.category, image: r.image,
    geminiVerdict: r.gemini_verdict, geminiConfidence: r.gemini_confidence,
    geminiReasoning: r.gemini_reasoning,
    scoreFactual: r.score_factual, sourceDiv: r.score_source_div,
    transparency: r.score_transparency, independence: r.score_independence,
    biasLeft: r.bias_left, biasCenter: r.bias_center, biasRight: r.bias_right,
    sourceCount: r.source_count, sponsoredFlag: r.sponsored_flag,
  }
}

function computeScore(n) {
  return Math.round((n.scoreFactual * 0.35 + n.sourceDiv * 0.25 + n.transparency * 0.25 + n.independence * 0.15))
}

const verdictConfig = {
  real: { icon: ShieldCheck, color: '#047857', bg: '#ecfdf5', label: 'REAL', border: '#a7f3d0' },
  misleading: { icon: ShieldAlert, color: '#b45309', bg: '#fffbeb', label: 'ENGAÑOSA', border: '#fde68a' },
  fake: { icon: ShieldX, color: '#b91c1c', bg: '#fef2f2', label: 'FALSA', border: '#fecaca' },
  unverified: { icon: ShieldQuestion, color: '#6b7280', bg: '#f9fafb', label: 'SIN VERIFICAR', border: '#e5e7eb' },
}

export default function SocialCard({ newsId }) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!newsId) {
      // Load latest top news
      supabase.from('news').select('*')
        .in('country_code', ['VE', 'CO', 'TECH'])
        .not('gemini_verdict', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1).single()
        .then(({ data }) => { if (data) setNews(mapRow(data)); setLoading(false) })
    } else {
      supabase.from('news').select('*').eq('id', newsId).single()
        .then(({ data }) => { if (data) setNews(mapRow(data)); setLoading(false) })
    }
  }, [newsId])

  if (loading || !news) return <div className="w-[1080px] h-[1080px] bg-white flex items-center justify-center"><span className="text-gray-400">Cargando...</span></div>

  const v = verdictConfig[news.geminiVerdict] || verdictConfig.unverified
  const Icon = v.icon
  const score = computeScore(news)
  const scoreColor = score >= 85 ? '#047857' : score >= 70 ? '#1b4f72' : score >= 50 ? '#b45309' : '#b91c1c'
  const scoreLabel = score >= 85 ? 'MUY FIABLE' : score >= 70 ? 'FIABLE' : score >= 50 ? 'PRECAUCIÓN' : 'NO FIABLE'

  return (
    <div id="social-card" className="w-[1080px] h-[1080px] bg-white relative overflow-hidden" style={{ fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #1b4f72 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      {/* Top bar with verdict */}
      <div className="relative flex items-center justify-between px-12 pt-10 pb-6">
        <img src="/logo.png" alt="Contexto Claro" className="h-14" />
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl" style={{ backgroundColor: v.bg, border: `2px solid ${v.border}` }}>
          <Icon size={24} style={{ color: v.color }} />
          <span className="text-lg font-black tracking-wider" style={{ color: v.color }}>{v.label}</span>
          {news.geminiConfidence > 0 && <span className="text-sm font-bold opacity-70" style={{ color: v.color }}>({news.geminiConfidence}%)</span>}
        </div>
      </div>

      {/* News image */}
      {news.image && (
        <div className="relative mx-12 h-[320px] rounded-2xl overflow-hidden">
          <img src={news.image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-5 flex items-center gap-2">
            <span className="text-2xl">{news.country}</span>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 text-white backdrop-blur-sm">{news.source}</span>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="px-12 pt-6">
        <h1 className="text-[28px] font-extrabold leading-tight line-clamp-3" style={{ color: '#1a2a3a' }}>
          {news.title}
        </h1>
      </div>

      {/* Score + Bias row */}
      <div className="flex items-center gap-6 px-12 pt-6">
        {/* Score circle */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg width={80} height={80} className="transform -rotate-90">
              <circle cx={40} cy={40} r={32} fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle cx={40} cy={40} r={32} fill="none" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 32} strokeDashoffset={2 * Math.PI * 32 - (score / 100) * 2 * Math.PI * 32}
                stroke={scoreColor} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black" style={{ color: scoreColor }}>{score}</span>
            </div>
          </div>
          <div>
            <span className="text-sm font-black tracking-wider block" style={{ color: scoreColor }}>{scoreLabel}</span>
            <span className="text-xs text-gray-400">Puntuación de confiabilidad</span>
          </div>
        </div>

        {/* Bias bar */}
        <div className="flex-1">
          <div className="flex h-5 rounded-full overflow-hidden border border-gray-300">
            {news.biasLeft > 0 && <div className="bg-red-500 flex items-center justify-center" style={{ width: `${news.biasLeft}%` }}>
              {news.biasLeft > 15 && <span className="text-[10px] font-bold text-white">{news.biasLeft}%</span>}
            </div>}
            {news.biasCenter > 0 && <div className="bg-white flex items-center justify-center border-x border-gray-200" style={{ width: `${news.biasCenter}%` }}>
              {news.biasCenter > 15 && <span className="text-[10px] font-bold text-gray-500">{news.biasCenter}%</span>}
            </div>}
            {news.biasRight > 0 && <div className="flex items-center justify-center" style={{ width: `${news.biasRight}%`, backgroundColor: '#1b4f72' }}>
              {news.biasRight > 15 && <span className="text-[10px] font-bold text-white">{news.biasRight}%</span>}
            </div>}
          </div>
          <div className="flex justify-between text-[10px] font-semibold mt-1">
            <span className="text-red-600">Izq {news.biasLeft}%</span>
            <span className="text-gray-400">Centro {news.biasCenter}%</span>
            <span style={{ color: '#1b4f72' }}>Der {news.biasRight}%</span>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {news.geminiReasoning && (
        <div className="mx-12 mt-5 p-4 rounded-xl" style={{ backgroundColor: v.bg, border: `1px solid ${v.border}` }}>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: v.color }}>
            {news.geminiReasoning.split('|')[0].trim()}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-12 py-6 flex items-center justify-between" style={{ backgroundColor: '#1b4f72' }}>
        <div>
          <span className="text-white text-sm font-bold">contextoclaro.com</span>
          <span className="text-white/60 text-xs ml-3">Filtramos el ruido. Entregamos la verdad.</span>
        </div>
        <div className="flex items-center gap-4 text-white/80 text-xs">
          <span>@don_cheli</span>
          <span>{news.sourceCount || 1} fuentes</span>
        </div>
      </div>

      {/* Sponsored badge */}
      {news.sponsoredFlag && (
        <div className="absolute top-10 right-12 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300">
          <span className="text-xs font-bold text-amber-700">PATROCINADA</span>
        </div>
      )}
    </div>
  )
}
