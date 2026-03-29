import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

function mapRow(r) {
  return { id: r.id, title: r.title, source: r.source_label, country: r.country, countryCode: r.country_code, category: r.category, image: r.image, publishedAt: r.published_at, sourceCount: r.source_count }
}

async function fetchBlindspots() {
  // Get recent VE-only and CO-only stories (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [veOnly, coOnly] = await Promise.all([
    supabase.from('news').select('id, title, source_label, country, country_code, category, image, published_at, source_count')
      .eq('country_code', 'VE').gte('published_at', weekAgo).lte('source_count', 2)
      .order('published_at', { ascending: false }).limit(6),
    supabase.from('news').select('id, title, source_label, country, country_code, category, image, published_at, source_count')
      .eq('country_code', 'CO').gte('published_at', weekAgo).lte('source_count', 2)
      .order('published_at', { ascending: false }).limit(6),
  ])

  return {
    veOnly: (veOnly.data || []).map(mapRow),
    coOnly: (coOnly.data || []).map(mapRow),
  }
}

function BlindspotCard({ news, onSelect }) {
  return (
    <div className="card p-4 cursor-pointer hover:border-accent/30 transition-colors group" onClick={() => onSelect(news.id)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{news.country}</span>
        <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded font-medium">{news.source}</span>
        <EyeOff size={12} className="text-amber-500 ml-auto" />
      </div>
      <h4 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-accent-light transition-colors">{news.title}</h4>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
          Solo {news.sourceCount || 1} fuente
        </span>
      </div>
    </div>
  )
}

export default function BlindspotLATAM({ onSelectNews }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBlindspots().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  if (data.veOnly.length === 0 && data.coOnly.length === 0) return null

  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <EyeOff size={18} className="text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-heading">Blindspot LATAM</h2>
          <p className="text-xs text-text-muted">Noticias con baja cobertura — posibles puntos ciegos informativos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VE blindspots */}
        {data.veOnly.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <span className="text-lg">🇻🇪</span>
              <span className="text-xs font-bold text-text-primary">Solo cubierto en Venezuela</span>
              <AlertTriangle size={12} className="text-amber-500" />
            </div>
            <div className="space-y-3">
              {data.veOnly.map(n => <BlindspotCard key={n.id} news={n} onSelect={onSelectNews} />)}
            </div>
          </div>
        )}

        {/* CO blindspots */}
        {data.coOnly.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <span className="text-lg">🇨🇴</span>
              <span className="text-xs font-bold text-text-primary">Solo cubierto en Colombia</span>
              <AlertTriangle size={12} className="text-amber-500" />
            </div>
            <div className="space-y-3">
              {data.coOnly.map(n => <BlindspotCard key={n.id} news={n} onSelect={onSelectNews} />)}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted mt-4 text-center">
        Noticias con pocas fuentes pueden indicar puntos ciegos informativos. Busca más perspectivas antes de formarte una opinión.
      </p>
    </section>
  )
}
