import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Accessibility, X, Type, Sun, Moon, Volume2, VolumeX,
  ZoomIn, ZoomOut, Link2, Eye, EyeOff, RotateCcw, Pause, Play
} from 'lucide-react'

const FONT_SIZES = [
  { label: 'Normal', value: 1, key: 'normal' },
  { label: 'Grande', value: 1.15, key: 'large' },
  { label: 'Muy grande', value: 1.3, key: 'xl' },
  { label: 'Máximo', value: 1.5, key: 'xxl' },
]

const STORAGE_KEY = 'a11y-preferences'

function loadPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

function savePreferences(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch {}
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const btnRef = useRef(null)

  const defaults = {
    fontSizeIndex: 0,
    highContrast: false,
    reducedMotion: false,
    dyslexiaFont: false,
    highlightLinks: false,
    largePointer: false,
  }

  const [prefs, setPrefs] = useState(() => loadPreferences() || defaults)
  const [speaking, setSpeaking] = useState(false)
  const [speechPaused, setSpeechPaused] = useState(false)

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      savePreferences(next)
      return next
    })
  }, [])

  // Apply preferences to DOM
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--font-scale', FONT_SIZES[prefs.fontSizeIndex].value)
    root.classList.toggle('a11y-high-contrast', prefs.highContrast)
    root.classList.toggle('a11y-reduced-motion', prefs.reducedMotion)
    root.classList.toggle('a11y-dyslexia', prefs.dyslexiaFont)
    root.classList.toggle('a11y-highlight-links', prefs.highlightLinks)
    root.classList.toggle('a11y-large-pointer', prefs.largePointer)
  }, [prefs])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus trap inside panel
  useEffect(() => {
    if (!open || !panelRef.current) return
    const focusable = panelRef.current.querySelectorAll('button, [tabindex="0"]')
    if (focusable.length) focusable[0].focus()
  }, [open])

  // Text-to-Speech
  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel()
    setSpeaking(false)
    setSpeechPaused(false)
  }, [])

  const toggleSpeech = useCallback(() => {
    if (speaking) {
      if (speechPaused) {
        speechSynthesis.resume()
        setSpeechPaused(false)
      } else {
        speechSynthesis.pause()
        setSpeechPaused(true)
      }
      return
    }

    const article = document.querySelector('.article-body')
    if (!article) return

    const text = article.innerText
    if (!text.trim()) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-419'
    utterance.rate = 0.95

    const voices = speechSynthesis.getVoices()
    const esVoice = voices.find(v => v.lang.startsWith('es'))
    if (esVoice) utterance.voice = esVoice

    utterance.onend = () => { setSpeaking(false); setSpeechPaused(false) }
    utterance.onerror = () => { setSpeaking(false); setSpeechPaused(false) }

    speechSynthesis.speak(utterance)
    setSpeaking(true)
  }, [speaking, speechPaused])

  // Cleanup speech on unmount
  useEffect(() => () => speechSynthesis.cancel(), [])

  const resetAll = () => {
    stopSpeaking()
    setPrefs(defaults)
    savePreferences(defaults)
  }

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(defaults) || speaking

  return (
    <>
      {/* Floating button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(prev => !prev)}
        className="a11y-fab"
        aria-label={open ? 'Cerrar panel de accesibilidad' : 'Abrir opciones de accesibilidad'}
        aria-expanded={open}
        aria-controls="a11y-panel"
        title="Accesibilidad"
      >
        <Accessibility size={24} />
        {hasChanges && <span className="a11y-fab-dot" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          id="a11y-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Opciones de accesibilidad"
          className="a11y-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Accessibility size={20} className="text-accent" />
              <h2 className="text-sm font-bold font-heading">Accesibilidad</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface transition-colors"
              aria-label="Cerrar panel de accesibilidad"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3" role="group" aria-label="Controles de accesibilidad">
            {/* Font size */}
            <div>
              <span className="a11y-label">
                <Type size={14} />
                Tamaño de texto
              </span>
              <div className="flex gap-1 mt-1.5">
                {FONT_SIZES.map((size, i) => (
                  <button
                    key={size.key}
                    onClick={() => updatePref('fontSizeIndex', i)}
                    className={`a11y-size-btn ${prefs.fontSizeIndex === i ? 'a11y-size-btn-active' : ''}`}
                    aria-label={`Texto ${size.label}`}
                    aria-pressed={prefs.fontSizeIndex === i}
                  >
                    <span style={{ fontSize: `${11 + i * 2}px` }}>A</span>
                  </button>
                ))}
              </div>
            </div>

            {/* High contrast */}
            <ToggleOption
              icon={prefs.highContrast ? Sun : Moon}
              label="Alto contraste"
              description="Mejora la legibilidad del texto"
              checked={prefs.highContrast}
              onChange={(v) => updatePref('highContrast', v)}
            />

            {/* Reduced motion */}
            <ToggleOption
              icon={EyeOff}
              label="Reducir animaciones"
              description="Desactiva movimientos y transiciones"
              checked={prefs.reducedMotion}
              onChange={(v) => updatePref('reducedMotion', v)}
            />

            {/* Dyslexia font */}
            <ToggleOption
              icon={Type}
              label="Fuente para dislexia"
              description="Tipografía más fácil de leer"
              checked={prefs.dyslexiaFont}
              onChange={(v) => updatePref('dyslexiaFont', v)}
            />

            {/* Highlight links */}
            <ToggleOption
              icon={Link2}
              label="Resaltar enlaces"
              description="Subraya y destaca todos los enlaces"
              checked={prefs.highlightLinks}
              onChange={(v) => updatePref('highlightLinks', v)}
            />

            {/* Large pointer */}
            <ToggleOption
              icon={Eye}
              label="Cursor grande"
              description="Aumenta el tamaño del cursor"
              checked={prefs.largePointer}
              onChange={(v) => updatePref('largePointer', v)}
            />

            {/* Text to speech */}
            <div className="pt-2 border-t border-border">
              <span className="a11y-label mb-1.5">
                <Volume2 size={14} />
                Leer artículo en voz alta
              </span>
              <div className="flex gap-2">
                <button
                  onClick={toggleSpeech}
                  className={`a11y-speech-btn ${speaking ? 'a11y-speech-btn-active' : ''}`}
                  aria-label={speaking ? (speechPaused ? 'Continuar lectura' : 'Pausar lectura') : 'Leer artículo en voz alta'}
                >
                  {speaking ? (speechPaused ? <Play size={14} /> : <Pause size={14} />) : <Volume2 size={14} />}
                  {speaking ? (speechPaused ? 'Continuar' : 'Pausar') : 'Escuchar'}
                </button>
                {speaking && (
                  <button
                    onClick={stopSpeaking}
                    className="a11y-speech-stop"
                    aria-label="Detener lectura"
                  >
                    <VolumeX size={14} />
                    Detener
                  </button>
                )}
              </div>
              {!document.querySelector('.article-body') && (
                <p className="text-[10px] text-text-muted mt-1">Abre un artículo para usar esta función</p>
              )}
            </div>

            {/* Reset */}
            {hasChanges && (
              <button
                onClick={resetAll}
                className="a11y-reset"
                aria-label="Restablecer todas las opciones de accesibilidad"
              >
                <RotateCcw size={14} />
                Restablecer todo
              </button>
            )}
          </div>

          {/* WCAG badge */}
          <div className="mt-4 pt-3 border-t border-border text-center">
            <span className="text-[10px] text-text-muted">
              WCAG 2.1 AA · Accesibilidad universal
            </span>
          </div>
        </div>
      )}

      {/* Live region for screen readers */}
      <div aria-live="polite" className="sr-only" role="status">
        {speaking && !speechPaused && 'Leyendo artículo en voz alta'}
        {speaking && speechPaused && 'Lectura en pausa'}
        {prefs.highContrast && 'Modo alto contraste activado'}
        {prefs.dyslexiaFont && 'Fuente para dislexia activada'}
      </div>
    </>
  )
}

function ToggleOption({ icon: Icon, label, description, checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`a11y-toggle ${checked ? 'a11y-toggle-active' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? 'activado' : 'desactivado'}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon size={14} className={checked ? 'text-accent' : 'text-text-muted'} />
        <div className="text-left min-w-0">
          <span className="text-xs font-semibold block">{label}</span>
          <span className="text-[10px] text-text-muted block">{description}</span>
        </div>
      </div>
      <div className={`a11y-switch ${checked ? 'a11y-switch-on' : ''}`}>
        <div className="a11y-switch-thumb" />
      </div>
    </button>
  )
}
