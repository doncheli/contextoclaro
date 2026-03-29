import { Eye } from 'lucide-react'

/**
 * Coverage Meter — muestra cuántos medios cubren una noticia y desde qué perspectiva.
 * Props: sourceCount, bias ({ left, center, right }), variant ('inline' | 'full')
 */
export default function CoverageMeter({ sourceCount = 0, bias, variant = 'inline' }) {
  const left = bias?.left || 0
  const center = bias?.center || 0
  const right = bias?.right || 0
  const total = sourceCount || 1

  if (variant === 'full') {
    return (
      <div className="rounded-xl p-5 bg-white border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-accent" />
          <span className="text-xs font-bold text-text-primary tracking-wide uppercase">Medidor de Cobertura</span>
        </div>

        {/* Source count indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex -space-x-1.5">
            {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-accent/10 border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-accent">{i + 1}</span>
              </div>
            ))}
            {total > 8 && (
              <div className="w-6 h-6 rounded-full bg-accent border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">+{total - 8}</span>
              </div>
            )}
          </div>
          <span className="text-sm font-bold text-text-primary">{total} {total === 1 ? 'fuente' : 'fuentes'}</span>
        </div>

        {/* Perspective bar */}
        <div className="mb-3">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 border border-gray-300">
            {left > 0 && <div className="bg-red-500 transition-all" style={{ width: `${left}%` }} />}
            {center > 0 && <div className="bg-white border-x border-gray-300 transition-all" style={{ width: `${center}%` }} />}
            {right > 0 && <div className="bg-[#1b4f72] transition-all" style={{ width: `${right}%` }} />}
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-between text-[10px] font-semibold">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-red-600">Izquierda {left}%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300 border border-gray-400" />
            <span className="text-gray-500">Centro {center}%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1b4f72]" />
            <span className="text-[#1b4f72]">Derecha {right}%</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
          {total <= 1 && 'Solo una fuente cubre esta noticia. La diversidad es baja.'}
          {total >= 2 && total <= 3 && `${total} fuentes cubren esta historia. Diversidad moderada.`}
          {total >= 4 && total <= 6 && `${total} fuentes cubren esta historia. Buena diversidad.`}
          {total > 6 && `${total} fuentes cubren esta historia. Excelente diversidad de cobertura.`}
        </p>
      </div>
    )
  }

  // Inline variant (for news cards)
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex h-1.5 flex-1 rounded-full overflow-hidden bg-gray-200">
        {left > 0 && <div className="bg-red-500" style={{ width: `${left}%` }} />}
        {center > 0 && <div className="bg-gray-400" style={{ width: `${center}%` }} />}
        {right > 0 && <div className="bg-[#1b4f72]" style={{ width: `${right}%` }} />}
      </div>
      <span className="text-[9px] text-text-muted font-medium shrink-0">{total} fuentes</span>
    </div>
  )
}
