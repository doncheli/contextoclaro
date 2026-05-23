import { useState } from 'react'
import { ShieldCheck, BarChart3, Eye, ArrowRight, ChevronRight } from 'lucide-react'

const SLIDES = [
  {
    icon: ShieldCheck,
    iconColor: 'text-success',
    iconBg: 'bg-success/15 border-success/25',
    accent: '#10b981',
    tag: 'Verificación IA',
    title: 'Cada noticia, analizada por inteligencia artificial',
    desc: 'Google Gemini lee y clasifica cada noticia como Real, Engañosa o Falsa — con razonamiento y nivel de confianza.',
    stat: '4 métricas',
    statLabel: 'por noticia',
  },
  {
    icon: Eye,
    iconColor: 'text-accent',
    iconBg: 'bg-accent/15 border-accent/25',
    accent: '#3b82f6',
    tag: 'Sin sesgo invisible',
    title: 'Ve quién cubre qué — y desde dónde lo cubre',
    desc: 'Medimos el espectro político de cada fuente: izquierda, centro y derecha. Tú decides con toda la información sobre la mesa.',
    stat: '+200 medios',
    statLabel: 'monitoreados',
  },
  {
    icon: BarChart3,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/15 border-warning/25',
    accent: '#f59e0b',
    tag: 'Tu dieta informativa',
    title: 'Descubre tus patrones de consumo de noticias',
    desc: 'El dashboard "Mi Consumo" registra qué lees, qué sesgo acumulás y te sugiere fuentes para balancear tu dieta informativa.',
    stat: '100% local',
    statLabel: 'datos en tu dispositivo',
  },
]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const Icon = slide.icon
  const isLast = step === SLIDES.length - 1

  const advance = () => {
    if (isLast) {
      localStorage.setItem('cc_onboarded', '1')
      onComplete()
    } else {
      setStep(s => s + 1)
    }
  }

  const skip = () => {
    localStorage.setItem('cc_onboarded', '1')
    onComplete()
  }

  return (
    <div className="gradient-bg min-h-screen flex flex-col items-center justify-between px-6 py-10 fade-in">
      {/* Header */}
      <div className="w-full flex items-center justify-between max-w-sm">
        <img src="/logo.png" alt="Contexto Claro" className="h-8 w-auto" />
        <button onClick={skip} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
          Saltar
        </button>
      </div>

      {/* Slide */}
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6 slide-up">
        {/* Icon bubble */}
        <div className={`w-24 h-24 rounded-3xl border flex items-center justify-center shadow-lg ${slide.iconBg}`}>
          <Icon size={44} className={slide.iconColor} />
        </div>

        {/* Tag */}
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{ background: `${slide.accent}20`, color: slide.accent, border: `1px solid ${slide.accent}40` }}>
          {slide.tag}
        </span>

        {/* Title */}
        <h1 className="text-2xl font-extrabold font-heading text-text-primary leading-tight">
          {slide.title}
        </h1>

        {/* Description */}
        <p className="text-sm text-text-secondary leading-relaxed">
          {slide.desc}
        </p>

        {/* Stat pill */}
        <div className="card px-5 py-3 flex items-center gap-3 border border-border">
          <span className="text-xl font-black font-heading" style={{ color: slide.accent }}>{slide.stat}</span>
          <span className="text-xs text-text-muted">{slide.statLabel}</span>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-2 bg-accent' : 'w-2 h-2 bg-text-muted/30 hover:bg-text-muted/60'}`}
              aria-label={`Ir al paso ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={advance}
          className="w-full py-4 rounded-2xl bg-accent hover:bg-accent-light text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-accent/20"
        >
          {isLast ? (
            <>Empezar a verificar noticias <ArrowRight size={18} /></>
          ) : (
            <>Siguiente <ChevronRight size={18} /></>
          )}
        </button>
      </div>
    </div>
  )
}
