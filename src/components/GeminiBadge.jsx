import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'

/**
 * Badge "IA: Real/Engañosa/Falsa/Sin verificar" con shield icon.
 * Variantes:
 *   - inline  (texto+icon en línea, sin fondo)   — para footer de cards
 *   - pill    (fondo coloreado, redondo)         — para destacar
 *   - glass   (overlay sobre imagen, hero)       — para hero card
 */
const CONFIG = {
  real:        { Icon: ShieldCheck,    label: 'Real',        text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  misleading:  { Icon: ShieldAlert,    label: 'Engañosa',    text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  fake:        { Icon: ShieldX,        label: 'Falsa',       text: 'text-danger',  bg: 'bg-danger/10',  border: 'border-danger/30' },
  unverified:  { Icon: ShieldQuestion, label: 'Sin verificar', text: 'text-text-muted', bg: 'bg-text-muted/10', border: 'border-text-muted/30' },
}

export default function GeminiBadge({ verdict, confidence, variant = 'inline', size = 'sm' }) {
  const cfg = CONFIG[verdict] || CONFIG.unverified
  const { Icon, label, text, bg, border } = cfg

  const iconSize = size === 'lg' ? 16 : 14

  if (variant === 'glass') {
    return (
      <div className={`flex items-center gap-1.5 bg-card/90 backdrop-blur rounded-full px-3 py-1 border ${border} ${text}`}>
        <Icon size={iconSize} strokeWidth={2.5} fill="currentColor" fillOpacity={0.15} />
        <span className="text-xs font-bold uppercase tracking-wider">IA: {label}</span>
      </div>
    )
  }

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${bg} border ${border} ${text}`}>
        <Icon size={iconSize} strokeWidth={2.5} />
        <span className="text-[10px] font-bold uppercase tracking-wider">IA: {label}</span>
        {confidence > 0 && (
          <span className="text-[10px] font-medium opacity-70">· {confidence}%</span>
        )}
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${text}`}>
      <Icon size={iconSize} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2} />
      <span className="text-[10px] font-bold uppercase tracking-wider">IA: {label}</span>
      {confidence > 0 && (
        <span className="text-[10px] text-text-muted font-medium">· {confidence}%</span>
      )}
    </div>
  )
}
