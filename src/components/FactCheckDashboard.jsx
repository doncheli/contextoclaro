import { useState } from 'react'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  EyeOff, TrendingUp, AlertTriangle, ChevronRight
} from 'lucide-react'
import BlindspotLATAM from './BlindspotLATAM'

function VerdictCard({ icon: Icon, color, bg, border, label, count, desc }) {
  return (
    <div className={`card p-5 border ${border} flex flex-col gap-3`}>
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className={`text-2xl font-black font-heading ${color}`}>{count ?? '—'}</p>
        <p className="text-sm font-bold text-text-primary mt-0.5">{label}</p>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function FlaggedNewsItem({ news, onSelect }) {
  const isFake = news.geminiVerdict === 'fake'
  return (
    <button
      className="w-full card p-4 text-left flex items-start gap-3 cursor-pointer hover:border-danger/30 transition-colors group"
      onClick={() => onSelect(news.id)}
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isFake ? 'bg-danger/15' : 'bg-warning/15'}`}>
        {isFake
          ? <ShieldX size={16} className="text-danger" />
          : <ShieldAlert size={16} className="text-warning" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide mb-1"
          style={{ color: isFake ? 'var(--color-danger)' : 'var(--color-warning)' }}>
          {isFake ? 'Falsa' : 'Engañosa'}
          {news.geminiConfidence > 0 && (
            <span className="text-text-muted font-normal normal-case ml-1">· {news.geminiConfidence}%</span>
          )}
        </p>
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-accent-light transition-colors">
          {news.title}
        </p>
        <p className="text-[11px] text-text-muted mt-1 flex items-center gap-2">
          <span>{news.country}</span>
          <span>·</span>
          <span>{news.sourceLabel || news.category}</span>
        </p>
      </div>
      <ChevronRight size={14} className="text-text-muted/50 shrink-0 mt-1" />
    </button>
  )
}

function EmptyFlagged() {
  return (
    <div className="card p-8 text-center border border-border">
      <ShieldCheck size={32} className="text-success mx-auto mb-3" />
      <p className="text-sm font-semibold text-text-primary">Sin alertas activas</p>
      <p className="text-xs text-text-muted mt-1">No se detectaron noticias falsas o engañosas recientemente</p>
    </div>
  )
}

export default function FactCheckDashboard({ flagged = [], stats, onSelectNews }) {
  const [showAll, setShowAll] = useState(false)

  const alertItems = flagged.filter(n =>
    n.geminiVerdict === 'fake' || n.geminiVerdict === 'misleading'
  ).sort((a, b) => {
    if (a.geminiVerdict === 'fake' && b.geminiVerdict !== 'fake') return -1
    if (b.geminiVerdict === 'fake' && a.geminiVerdict !== 'fake') return 1
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
  })

  const visible = showAll ? alertItems : alertItems.slice(0, 6)

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 sm:pb-10 fade-in">
      {/* Page header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/10">
          <ShieldCheck size={28} className="text-accent" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary mb-2">
          Verificaciones
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Alertas de desinformación activas y puntos ciegos informativos en Venezuela y Colombia.
        </p>
      </div>

      {/* Verdict stats */}
      {stats && (
        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">
            Últimas 24 horas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <VerdictCard
              icon={ShieldCheck}
              color="text-success"
              bg="bg-success/15"
              border="border-success/20"
              label="Noticias reales"
              count={stats.verified}
              desc="Verificadas por IA"
            />
            <VerdictCard
              icon={ShieldAlert}
              color="text-warning"
              bg="bg-warning/15"
              border="border-warning/20"
              label="Engañosas"
              count={stats.misleading}
              desc="Información parcial o manipulada"
            />
            <VerdictCard
              icon={ShieldX}
              color="text-danger"
              bg="bg-danger/15"
              border="border-danger/20"
              label="Falsas"
              count={stats.fake}
              desc="Información falsa detectada"
            />
            <VerdictCard
              icon={ShieldQuestion}
              color="text-text-muted"
              bg="bg-surface"
              border="border-border"
              label="Sin verificar"
              count={stats.total ? stats.total - (stats.aiValidated || 0) : null}
              desc="Pendientes de análisis IA"
            />
          </div>
        </section>
      )}

      {/* Active alerts */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-danger/15 border border-danger/20 flex items-center justify-center">
            <AlertTriangle size={18} className="text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading">Alertas activas</h2>
            <p className="text-xs text-text-muted">Noticias falsas o engañosas detectadas recientemente</p>
          </div>
          {alertItems.length > 0 && (
            <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-danger/15 text-danger border border-danger/20">
              {alertItems.length}
            </span>
          )}
        </div>

        {alertItems.length === 0 ? (
          <EmptyFlagged />
        ) : (
          <div className="space-y-2">
            {visible.map(news => (
              <FlaggedNewsItem key={news.id} news={news} onSelect={onSelectNews} />
            ))}
            {alertItems.length > 6 && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="w-full py-3 rounded-xl text-xs font-semibold text-accent hover:text-accent-light border border-border hover:border-accent/30 transition-colors flex items-center justify-center gap-1.5"
              >
                {showAll
                  ? 'Mostrar menos'
                  : `Ver ${alertItems.length - 6} alertas más`}
                <ChevronRight size={13} className={`transition-transform ${showAll ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Blindspot section */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
            <EyeOff size={18} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading">Puntos ciegos informativos</h2>
            <p className="text-xs text-text-muted">Noticias con baja cobertura que podrían estar pasando inadvertidas</p>
          </div>
        </div>
        <BlindspotLATAM onSelectNews={onSelectNews} />
      </section>
    </main>
  )
}
