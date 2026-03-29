import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldX, CheckCircle, XCircle, Building2, Users, Eye, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

function ScoreRing({ score }) {
  const r = 40, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-accent' : score >= 40 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="relative flex items-center justify-center">
      <svg width={100} height={100} className="transform -rotate-90">
        <circle cx={50} cy={50} r={r} fill="none" className="stroke-gray-200" strokeWidth="8" />
        <circle cx={50} cy={50} r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className={`stroke-current ${color}`} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-black font-heading ${color}`}>{score}</span>
        <span className="text-[9px] text-text-muted">/100</span>
      </div>
    </div>
  )
}

function BooleanIndicator({ label, value, tooltip }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-text-secondary">{label}</span>
      {value ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle size={14} /> Sí</span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><XCircle size={14} /> No</span>
      )}
    </div>
  )
}

function MetricBar({ label, value, inverted = false }) {
  const displayVal = inverted ? 100 - value : value
  const color = displayVal >= 70 ? 'bg-green-500' : displayVal >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-bold text-text-primary">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function OwnershipCard({ outlet }) {
  if (!outlet.owner_name) return null
  const typeIcons = { independiente: Users, privado: Building2, conglomerado: Building2, corporación: Building2, fundación: Users, mixto: Building2 }
  const Icon = typeIcons[outlet.owner_type] || Building2
  return (
    <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-accent" />
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Propiedad del medio</h4>
      </div>
      <div className="space-y-2 text-xs">
        <div><span className="text-text-muted">Dueño:</span> <span className="font-semibold text-text-primary">{outlet.owner_name}</span></div>
        <div><span className="text-text-muted">Tipo:</span> <span className="font-semibold text-text-primary capitalize">{outlet.owner_type}</span></div>
        {outlet.parent_company && <div><span className="text-text-muted">Grupo:</span> <span className="font-semibold text-text-primary">{outlet.parent_company}</span></div>}
        {outlet.political_affiliation && <div><span className="text-text-muted">Afiliación:</span> <span className="font-semibold text-text-primary capitalize">{outlet.political_affiliation}</span></div>}
        {outlet.owner_details && <p className="text-text-muted mt-2 leading-relaxed">{outlet.owner_details}</p>}
      </div>
    </div>
  )
}

export function NutritionLabelCard({ outlet, compact = false }) {
  if (!outlet) return null
  return (
    <div className={`rounded-xl border border-border bg-white ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-start gap-4">
        <ScoreRing score={outlet.overall_score} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold font-heading text-text-primary text-lg">{outlet.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-text-muted">{outlet.country_code === 'VE' ? '🇻🇪 Venezuela' : outlet.country_code === 'CO' ? '🇨🇴 Colombia' : '🌐'}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              outlet.bias?.includes('izquierda') ? 'bg-red-50 text-red-600' :
              outlet.bias?.includes('derecha') ? 'bg-blue-50 text-[#1b4f72]' :
              'bg-gray-100 text-gray-600'
            }`}>{outlet.bias?.toUpperCase()}</span>
          </div>
          {outlet.website_url && <a href={outlet.website_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline mt-1 block">{outlet.website_url.replace('https://', '')}</a>}
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Indicadores de calidad</h4>
            <BooleanIndicator label="¿Corrige errores públicamente?" value={outlet.corrects_errors} />
            <BooleanIndicator label="¿Separa opinión de información?" value={outlet.separates_opinion} />
            <MetricBar label="Transparencia de financiamiento" value={outlet.funding_transparency} />
            <MetricBar label="Titulares engañosos" value={outlet.misleading_headlines} inverted />
          </div>

          <OwnershipCard outlet={outlet} />

          {outlet.founded_year && (
            <p className="text-[10px] text-text-muted mt-4">Fundado en {outlet.founded_year}</p>
          )}
        </>
      )}
    </div>
  )
}

export default function MediaOutletPage({ sourceName, onClose }) {
  const [outlet, setOutlet] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sourceName) return
    const slug = sourceName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    supabase.from('media_outlets').select('*').or(`slug.eq.${slug},name.ilike.%${sourceName}%`).limit(1).single()
      .then(({ data }) => { setOutlet(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sourceName])

  if (loading) return <div className="text-center py-20 text-sm text-text-muted">Cargando perfil del medio...</div>
  if (!outlet) return (
    <div className="text-center py-20">
      <p className="text-sm text-text-secondary mb-4">No tenemos datos de este medio todavía.</p>
      <button onClick={onClose} className="text-sm text-accent hover:underline">Volver</button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent mb-6 group">
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Volver
      </button>
      <NutritionLabelCard outlet={outlet} />
    </div>
  )
}
