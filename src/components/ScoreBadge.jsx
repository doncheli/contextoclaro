import { useMemo } from 'react'

/**
 * Badge circular con score 0-10 (o 0-100 escalado).
 * Variantes:
 *   - sm  (24px, sin dot)         — para news cards
 *   - md  (28px, con dot)         — para grid cards con imagen
 *   - lg  (32px, glass overlay)   — para hero card
 */
function colorFor(score) {
  if (score >= 8) return { text: 'text-success', bg: 'bg-success/20', bgSoft: 'bg-success/10', border: 'border-success/30', dot: 'bg-success' }
  if (score >= 5) return { text: 'text-warning', bg: 'bg-warning/20', bgSoft: 'bg-warning/10', border: 'border-warning/30', dot: 'bg-warning' }
  return { text: 'text-danger', bg: 'bg-danger/20', bgSoft: 'bg-danger/10', border: 'border-danger/30', dot: 'bg-danger' }
}

export default function ScoreBadge({ score, size = 'md', variant = 'pill' }) {
  const normalized = useMemo(() => {
    if (score == null || isNaN(score)) return null
    const s = Number(score)
    return s > 10 ? Math.round(s / 10 * 10) / 10 : Math.round(s * 10) / 10
  }, [score])

  if (normalized == null) return null

  const c = colorFor(normalized)
  const display = normalized.toFixed(1)

  if (variant === 'circle') {
    const dims = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'
    return (
      <div
        className={`${dims} rounded-full ${c.bg} flex items-center justify-center border ${c.border}`}
        title={`Puntuación de fiabilidad: ${display}/10`}
      >
        <span className={`font-bold ${c.text}`}>{display}</span>
      </div>
    )
  }

  if (variant === 'glass') {
    return (
      <div
        className={`flex items-center gap-1.5 bg-card/90 backdrop-blur rounded-full px-3 py-1 border ${c.border}`}
        title={`Puntuación de fiabilidad: ${display}/10`}
      >
        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className={`text-sm font-bold ${c.text}`}>{display}</span>
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${c.bgSoft} border ${c.border}`}
      title={`Puntuación de fiabilidad: ${display}/10`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span className={`text-xs font-bold ${c.text}`}>{display}</span>
    </div>
  )
}
