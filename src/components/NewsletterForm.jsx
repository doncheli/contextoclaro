import { useState } from 'react'
import { Mail, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { trackNewsletterSubscribe, trackNewsletterDismiss } from '../lib/analytics'

export default function NewsletterForm({ variant = 'inline', source = 'footer' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('cc_newsletter_dismissed') === 'true' } catch { return false }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setStatus('loading')
    try {
      const { error } = await supabase.from('newsletter_subscribers').insert({ email, source })
      if (error && error.code === '23505') {
        setStatus('success') // Ya suscrito
      } else if (error) {
        setStatus('error')
      } else {
        setStatus('success')
        trackNewsletterSubscribe(source)
      }
    } catch {
      setStatus('error')
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('cc_newsletter_dismissed', 'true') } catch {}
    trackNewsletterDismiss(source)
  }

  if (dismissed && variant === 'banner') return null

  if (status === 'success') {
    return (
      <div className={`rounded-xl border border-green-200 bg-green-50 p-5 ${variant === 'banner' ? 'mx-4 sm:mx-6 lg:mx-8 mt-10' : 'mt-4'}`}>
        <div className="flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div>
            <span className="text-sm font-bold text-green-700">¡Suscrito!</span>
            <p className="text-xs text-green-600 mt-0.5">Cada domingo recibirás "El Filtro" con las noticias falsas más peligrosas de la semana.</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'banner') {
    return (
      <div className="mx-4 sm:mx-6 lg:mx-8 mt-10 rounded-2xl border border-accent/20 bg-gradient-to-r from-accent-muted via-white to-accent-muted p-6 sm:p-8 relative">
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-text-muted hover:text-text-primary text-xs">✕</button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
            <Mail size={28} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold font-heading text-text-primary">El Filtro — Newsletter Semanal</h3>
            <p className="text-sm text-text-secondary mt-1">Las 3 noticias falsas más peligrosas de la semana, medios expuestos y datos de sesgo. Cada domingo en tu correo.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 w-full sm:w-auto shrink-0">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="flex-1 sm:w-56 px-4 py-2.5 text-sm rounded-xl bg-white border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors shrink-0 disabled:opacity-50"
            >
              {status === 'loading' ? '...' : 'Suscribirme'}
            </button>
          </form>
        </div>
        {status === 'error' && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle size={12} /> Error al suscribir. Intenta de nuevo.</p>}
      </div>
    )
  }

  // Inline (footer)
  return (
    <div className="mt-4">
      <span className="text-xs font-bold text-text-primary block mb-2">Newsletter semanal</span>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          className="flex-1 px-3 py-2 text-xs rounded-lg bg-white border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
        />
        <button type="submit" disabled={status === 'loading'} className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-light transition-colors disabled:opacity-50">
          {status === 'loading' ? '...' : 'OK'}
        </button>
      </form>
      {status === 'error' && <p className="text-[10px] text-red-600 mt-1">Error. Intenta de nuevo.</p>}
    </div>
  )
}
