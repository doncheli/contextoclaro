import { useState } from 'react'
import { BarChart3, TrendingUp, Eye, AlertTriangle, Trash2 } from 'lucide-react'
import { getConsumptionStats, clearConsumption } from '../lib/consumptionTracker'

function StatCard({ label, value, sub, color = 'text-accent' }) {
  return (
    <div className="card p-4 border border-border text-center">
      <span className={`text-2xl font-black font-heading ${color}`}>{value}</span>
      <span className="block text-xs font-semibold text-text-primary mt-1">{label}</span>
      {sub && <span className="block text-[10px] text-text-muted mt-0.5">{sub}</span>}
    </div>
  )
}

function BiasGauge({ left, center, right }) {
  return (
    <div className="card p-5 border border-border">
      <h4 className="text-xs font-bold text-text-primary mb-4 uppercase tracking-wide">Tu sesgo acumulado</h4>
      <div className="flex h-6 rounded-full overflow-hidden border border-gray-300 mb-3">
        <div className="bg-red-500 flex items-center justify-center" style={{ width: `${left}%` }}>
          {left > 15 && <span className="text-[9px] font-bold text-white">{left}%</span>}
        </div>
        <div className="bg-white flex items-center justify-center border-x border-gray-200" style={{ width: `${center}%` }}>
          {center > 15 && <span className="text-[9px] font-bold text-gray-500">{center}%</span>}
        </div>
        <div className="bg-[#1b4f72] flex items-center justify-center" style={{ width: `${right}%` }}>
          {right > 15 && <span className="text-[9px] font-bold text-white">{right}%</span>}
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-semibold">
        <span className="text-red-600">Izquierda {left}%</span>
        <span className="text-gray-500">Centro {center}%</span>
        <span className="text-[#1b4f72]">Derecha {right}%</span>
      </div>
    </div>
  )
}

function BarList({ title, items, icon: Icon }) {
  if (!items || items.length === 0) return null
  const max = Math.max(...items.map(i => i.pct))
  return (
    <div className="card p-5 border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-accent" />
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">{title}</h4>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-primary font-medium">{item.name || item.code}</span>
              <span className="text-xs text-text-muted">{item.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-accent-light transition-all" style={{ width: `${(item.pct / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MyConsumptionDashboard() {
  const [stats, setStats] = useState(() => getConsumptionStats())

  if (!stats || stats.total === 0) {
    return (
      <div className="text-center py-16">
        <Eye size={40} className="text-text-muted/30 mx-auto mb-4" />
        <h3 className="text-lg font-bold font-heading text-text-primary mb-2">Sin datos todavía</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          A medida que leas noticias en Contexto Claro, aquí verás un análisis de tu consumo informativo:
          sesgo acumulado, fuentes más leídas y recomendaciones personalizadas.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Noticias leídas" value={stats.total} sub={`Desde ${stats.since}`} />
        <StatCard label="Fuentes diferentes" value={stats.topSources.length} sub="Diversidad de medios" color="text-accent-light" />
        <StatCard label="Sesgo predominante" value={stats.bias.left > stats.bias.right ? 'Izq' : stats.bias.right > stats.bias.left ? 'Der' : 'Centro'} color={stats.bias.left > stats.bias.right ? 'text-red-600' : stats.bias.right > stats.bias.left ? 'text-[#1b4f72]' : 'text-gray-500'} />
        <StatCard label="País más leído" value={stats.countries[0]?.code || '—'} sub={`${stats.countries[0]?.pct || 0}% de lecturas`} color="text-accent" />
      </div>

      {/* Bias gauge */}
      <div className="mb-6">
        <BiasGauge left={stats.bias.left} center={stats.bias.center} right={stats.bias.right} />
      </div>

      {/* Recommendation */}
      <div className="card p-5 border border-accent-light/20 bg-gradient-to-br from-accent-muted to-transparent mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-accent-light shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-1">Recomendación personalizada</h4>
            <p className="text-sm text-text-secondary leading-relaxed">{stats.recommendation}</p>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <BarList title="Fuentes más leídas" items={stats.topSources} icon={BarChart3} />
        <BarList title="Categorías" items={stats.categories} icon={TrendingUp} />
      </div>

      {/* Clear data */}
      <div className="text-center">
        <button
          onClick={() => { clearConsumption(); setStats(null) }}
          className="text-xs text-text-muted hover:text-danger transition-colors flex items-center gap-1 mx-auto"
        >
          <Trash2 size={12} /> Borrar mis datos de consumo
        </button>
      </div>
    </div>
  )
}
