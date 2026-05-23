import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Banner rojo superior con ticker animado de noticias falsas/engañosas.
 * Solo se renderiza si hay items. Self-hides cuando la lista está vacía.
 */
export default function BreakingBanner({ flagged = [], onSelect }) {
  const items = useMemo(() => {
    if (!Array.isArray(flagged)) return []
    return flagged.slice(0, 8).map(n => ({
      id: n.id,
      verdict: n.geminiVerdict || 'misleading',
      title: n.title,
    }))
  }, [flagged])

  if (items.length === 0) return null

  // Duplicamos los items para que el loop sea seamless.
  const loopItems = [...items, ...items]

  const labelFor = (v) => v === 'fake' ? 'FALSA' : v === 'misleading' ? 'ENGAÑOSA' : 'ALERTA'
  const emojiFor = (v) => v === 'fake' ? '🚨' : v === 'misleading' ? '⚠️' : '❗'

  return (
    <div
      className="bg-danger text-white py-1.5 border-b border-danger/80 w-full text-sm font-medium overflow-hidden"
      role="alert"
      aria-label="Alertas de noticias falsas y engañosas"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center">
          <div className="shrink-0 flex items-center gap-1.5 px-4 border-r border-white/20 self-stretch">
            <AlertTriangle size={14} strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-wider">Alertas IA</span>
          </div>
          <div className="bb-ticker-wrap flex-1 px-4">
            <div className="bb-ticker flex items-center gap-12 whitespace-nowrap">
              {loopItems.map((item, i) => (
                <button
                  key={`${item.id}-${i}`}
                  onClick={() => onSelect?.(item.id)}
                  className="hover:underline shrink-0"
                >
                  <span className="font-bold mr-1.5">{emojiFor(item.verdict)} {labelFor(item.verdict)}:</span>
                  <span className="font-normal">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
