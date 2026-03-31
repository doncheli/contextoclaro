import { useState } from 'react'
import { Mail, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import { trackNewsletterSubscribe, trackNewsletterDismiss } from '../lib/analytics'

// Substack URL — update this when the account is created
const SUBSTACK_URL = 'https://contextoclaro.substack.com'

export default function NewsletterForm({ variant = 'inline', source = 'footer' }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('cc_newsletter_dismissed') === 'true' } catch { return false }
  })

  const handleClick = () => {
    trackNewsletterSubscribe(source)
    window.open(SUBSTACK_URL + '/subscribe', '_blank')
  }

  const handleDismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('cc_newsletter_dismissed', 'true') } catch {}
    trackNewsletterDismiss(source)
  }

  if (dismissed && variant === 'banner') return null

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
            <p className="text-sm text-text-secondary mt-1">Las 3 noticias falsas más peligrosas de la semana, 1 medio expuesto y datos de sesgo. Cada domingo en tu correo.</p>
          </div>
          <button
            onClick={handleClick}
            className="px-6 py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors shrink-0 flex items-center gap-2"
          >
            <Mail size={16} /> Suscribirme gratis
          </button>
        </div>
      </div>
    )
  }

  // Inline variant (for footer)
  return (
    <div className="mt-4">
      <span className="text-xs font-bold text-text-primary block mb-2">Newsletter semanal</span>
      <button
        onClick={handleClick}
        className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-light transition-colors flex items-center justify-center gap-2"
      >
        <Mail size={14} /> Suscribirme en Substack
      </button>
    </div>
  )
}
