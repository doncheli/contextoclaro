import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle } from 'lucide-react'

/**
 * News Triptych — Muestra la misma noticia desde 3 perspectivas: izquierda, centro, derecha.
 * Props: sources (array de news_sources con bias, name, stance, credibility)
 */

function groupByPerspective(sources) {
  const left = []
  const center = []
  const right = []
  ;(sources || []).forEach(s => {
    const b = (s.bias || 'centro').toLowerCase()
    if (b.includes('izquierda') && !b.includes('centro')) left.push(s)
    else if (b.includes('derecha') && !b.includes('centro')) right.push(s)
    else if (b.includes('centro-izquierda')) { left.push(s); center.push(s) }
    else if (b.includes('centro-derecha')) { right.push(s); center.push(s) }
    else center.push(s)
  })
  return { left, center, right }
}

function PerspectivePanel({ label, color, bgColor, borderColor, sources }) {
  const hasSource = sources.length > 0
  return (
    <div className={`flex-1 rounded-xl p-4 border-2 ${hasSource ? borderColor : 'border-gray-200'} ${hasSource ? bgColor : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className={`text-xs font-bold tracking-wide uppercase ${hasSource ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
      </div>
      {hasSource ? (
        <div className="space-y-3">
          {sources.map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-primary">{s.name}</span>
                {s.credibility && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    s.credibility >= 80 ? 'bg-green-50 text-green-700' :
                    s.credibility >= 60 ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {s.credibility}/100
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">{s.stance}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <AlertTriangle size={20} className="text-gray-300 mx-auto mb-2" />
          <p className="text-[11px] text-text-muted">Sin cobertura desde esta perspectiva</p>
          <p className="text-[10px] text-text-muted mt-1">Punto ciego informativo</p>
        </div>
      )}
    </div>
  )
}

export default function NewsTriptych({ sources }) {
  if (!sources || sources.length < 1) return null
  const { left, center, right } = groupByPerspective(sources)

  // Only show if there's at least some perspective variety
  const perspectives = [left.length > 0, center.length > 0, right.length > 0].filter(Boolean).length
  if (perspectives < 1) return null

  return (
    <section className="mt-8 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-accent" />
        <h3 className="text-sm font-bold font-heading text-text-primary">Vista por perspectiva</h3>
        <span className="text-[10px] text-text-muted">— La misma historia desde diferentes ángulos</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <PerspectivePanel
          label="Izquierda"
          color="bg-red-500"
          bgColor="bg-red-50/50"
          borderColor="border-red-200"
          sources={left}
        />
        <PerspectivePanel
          label="Centro"
          color="bg-gray-400"
          bgColor="bg-gray-50"
          borderColor="border-gray-200"
          sources={center}
        />
        <PerspectivePanel
          label="Derecha"
          color="bg-[#1b4f72]"
          bgColor="bg-blue-50/50"
          borderColor="border-blue-200"
          sources={right}
        />
      </div>
      {perspectives < 3 && (
        <p className="text-[10px] text-amber-600 mt-3 flex items-center gap-1">
          <AlertTriangle size={12} />
          {perspectives === 1
            ? 'Solo una perspectiva cubre esta noticia. Busca más fuentes antes de formarte una opinión.'
            : 'Falta cobertura desde alguna perspectiva. La diversidad de fuentes es limitada.'}
        </p>
      )}
    </section>
  )
}
