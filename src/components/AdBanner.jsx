import { useEffect, useRef } from 'react'
import { trackAdImpression } from '../lib/analytics'

// Google AdSense Publisher ID — replace with your real ID
const ADSENSE_PUB_ID = 'ca-pub-8704878719669732'

// AdSense account connected
const ADS_ENABLED = true

/**
 * AdBanner — Non-invasive ad placements for Contexto Claro
 *
 * Variants:
 * - "feed-inline"   → Native ad between news cards (blends with feed)
 * - "sidebar"       → 300x250 rectangle in article sidebar
 * - "section-break"  → Horizontal banner between sections (728x90)
 * - "article-inline" → Between paragraphs in article body
 */
export default function AdBanner({ variant = 'section-break', className = '' }) {
  const adRef = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!ADS_ENABLED || pushed.current) return
    try {
      if (window.adsbygoogle && adRef.current) {
        window.adsbygoogle.push({})
        pushed.current = true
        trackAdImpression(variant)
      }
    } catch (e) {
      // AdSense not loaded yet
    }
  }, [])

  // Ad unit slots — reemplazar con tus slot IDs reales cuando los crees en AdSense
  // Por ahora usa auto-ads con format="auto" y responsive="true"
  const configs = {
    'feed-inline': {
      format: 'fluid',
      layoutKey: '-fb+5w+4e-db+86',
      style: { display: 'block' },
      slot: '1234567890',
      wrapper: 'my-4 mx-auto max-w-[600px]',
    },
    'sidebar': {
      format: 'rectangle',
      style: { display: 'inline-block', width: '300px', height: '250px' },
      slot: '1234567891',
      wrapper: 'my-4',
    },
    'section-break': {
      format: 'horizontal',
      style: { display: 'block', textAlign: 'center', height: '90px' },
      slot: '1234567892',
      wrapper: 'my-8 mx-auto max-w-3xl',
    },
    'article-inline': {
      format: 'fluid',
      layoutKey: '-fb+5w+4e-db+86',
      style: { display: 'block' },
      slot: '1234567893',
      wrapper: 'my-6',
    },
  }

  const config = configs[variant] || configs['section-break']

  // Hide completely when ads are not serving yet
  if (!ADS_ENABLED) return null

  return (
    <div className={`ad-container ${config.wrapper} ${className}`} aria-hidden="true">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={config.style}
        data-ad-client={ADSENSE_PUB_ID}
        data-ad-slot={config.slot}
        data-ad-format={config.format}
        {...(config.layoutKey ? { 'data-ad-layout-key': config.layoutKey } : {})}
        data-full-width-responsive="true"
      />
    </div>
  )
}

/**
 * Dev placeholder — shows where ads will appear once AdSense is connected.
 * Styled to blend with the dark theme and not be jarring.
 */
function AdPlaceholder({ variant, className = '' }) {
  const sizes = {
    'feed-inline': { h: 'h-[100px]', w: 'max-w-[600px]', label: 'Ad nativo en feed' },
    'sidebar': { h: 'h-[250px]', w: 'w-[300px]', label: 'Ad sidebar 300×250' },
    'section-break': { h: 'h-[90px]', w: 'max-w-3xl', label: 'Ad entre secciones 728×90' },
    'article-inline': { h: 'h-[100px]', w: 'max-w-2xl', label: 'Ad entre párrafos' },
  }

  const size = sizes[variant] || sizes['section-break']

  return (
    <div
      className={`${size.h} ${size.w} mx-auto rounded-xl border border-dashed border-border/50 flex items-center justify-center gap-2 my-6 ${className}`}
      aria-hidden="true"
    >
      <span className="text-[10px] text-text-muted/40 uppercase tracking-widest font-medium">
        {size.label}
      </span>
    </div>
  )
}

/**
 * AdSense script loader — call once in App or index.html
 */
export function loadAdSenseScript() {
  if (!ADS_ENABLED) return
  if (document.querySelector('script[src*="adsbygoogle"]')) return

  const script = document.createElement('script')
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}`
  script.async = true
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}
