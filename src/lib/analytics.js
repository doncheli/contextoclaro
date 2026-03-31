/**
 * Google Analytics event tracking for Contexto Claro
 * GA4 Property: G-PSMG5L90D1
 */

function gtag() {
  if (window.gtag) {
    window.gtag(...arguments)
  }
}

// ═══════════════════════════════════════════
// 1. LECTURA DE NOTICIAS
// ═══════════════════════════════════════════

export function trackArticleView(article) {
  gtag('event', 'article_view', {
    article_id: article.id,
    article_title: article.title?.substring(0, 100),
    article_source: article.sourceLabel,
    article_country: article.countryCode,
    article_category: article.category,
    gemini_verdict: article.geminiVerdict || 'none',
  })
}

export function trackArticleScrollDepth(articleId, depth) {
  gtag('event', 'article_scroll_depth', {
    article_id: articleId,
    scroll_depth: depth, // 25, 50, 75, 100
  })
}

export function trackArticleTimeSpent(articleId, seconds) {
  gtag('event', 'article_time_spent', {
    article_id: articleId,
    time_seconds: seconds,
    time_bucket: seconds < 15 ? 'bounce' : seconds < 60 ? 'scan' : seconds < 180 ? 'read' : 'deep_read',
  })
}

// ═══════════════════════════════════════════
// 2. ENGAGEMENT CON VERIFICACIÓN IA
// ═══════════════════════════════════════════

export function trackVerificationView(articleId, verdict, confidence) {
  gtag('event', 'verification_view', {
    article_id: articleId,
    verdict,
    confidence,
  })
}

export function trackSourcesClick(articleId, sourceCount) {
  gtag('event', 'sources_click', {
    article_id: articleId,
    source_count: sourceCount,
  })
}

export function trackFakeNewsAlertView(article) {
  gtag('event', 'fake_news_alert_view', {
    article_id: article.id,
    article_title: article.title?.substring(0, 100),
    article_source: article.sourceLabel,
    verdict: article.geminiVerdict,
    confidence: article.geminiConfidence,
  })
}

export function trackSponsoredAlertView(article) {
  gtag('event', 'sponsored_alert_view', {
    article_id: article.id,
    article_title: article.title?.substring(0, 100),
    sponsored_by: article.sponsoredFlag,
  })
}

// ═══════════════════════════════════════════
// 3. NAVEGACIÓN Y DESCUBRIMIENTO
// ═══════════════════════════════════════════

export function trackCountryFilter(countryCode) {
  gtag('event', 'country_filter', {
    country: countryCode,
  })
}

export function trackSearch(query, resultCount) {
  gtag('event', 'search', {
    search_term: query,
    result_count: resultCount,
  })
}

export function trackSectionView(sectionName) {
  gtag('event', 'section_view', {
    section: sectionName,
  })
}

export function trackCarouselInteraction(action, slideIndex, articleId) {
  gtag('event', 'carousel_interaction', {
    action, // 'next', 'prev', 'dot_click', 'auto_advance'
    slide_index: slideIndex,
    article_id: articleId,
  })
}

// ═══════════════════════════════════════════
// 4. CONVERSIÓN Y RETENCIÓN
// ═══════════════════════════════════════════

export function trackShareClick(articleId, method) {
  gtag('event', 'share', {
    article_id: articleId,
    method, // 'copy_link', 'twitter', 'whatsapp', etc.
  })
}

export function trackAdImpression(variant) {
  gtag('event', 'ad_impression', {
    ad_variant: variant, // 'feed-inline', 'sidebar', 'section-break', 'article-inline'
  })
}

export function trackReturnToFeed(fromArticleId) {
  gtag('event', 'return_to_feed', {
    from_article_id: fromArticleId,
  })
}

// ═══════════════════════════════════════════
// HOOKS: Scroll depth observer
// ═══════════════════════════════════════════

const firedDepths = new Set()

export function resetScrollTracking() {
  firedDepths.clear()
}

export function observeScrollDepth(articleId, containerEl) {
  if (!containerEl) return () => {}

  const handler = () => {
    const { scrollTop, scrollHeight, clientHeight } = containerEl === document.documentElement
      ? { scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight, clientHeight: window.innerHeight }
      : containerEl

    const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
    const thresholds = [25, 50, 75, 100]

    for (const t of thresholds) {
      if (percent >= t && !firedDepths.has(`${articleId}-${t}`)) {
        firedDepths.add(`${articleId}-${t}`)
        trackArticleScrollDepth(articleId, t)
      }
    }
  }

  const target = containerEl === document.documentElement ? window : containerEl
  target.addEventListener('scroll', handler, { passive: true })
  return () => target.removeEventListener('scroll', handler)
}

// ═══════════════════════════════════════════
// FIDELIZACIÓN
// ═══════════════════════════════════════════

export function trackPwaInstall(source) {
  gtag('event', 'pwa_install_prompt', { source })
}

export function trackPwaInstalled() {
  gtag('event', 'pwa_installed')
}

export function trackPushPermission(result) {
  gtag('event', 'push_permission', { result }) // granted, denied, dismissed
}

export function trackPollVote(articleId, verdict, userVote) {
  gtag('event', 'poll_vote', {
    article_id: articleId,
    ai_verdict: verdict,
    user_vote: userVote, // 'real' or 'fake'
    user_correct: verdict === 'real' ? userVote === 'real' : userVote === 'fake',
  })
}

export function trackPollResult(articleId, userCorrect) {
  gtag('event', 'poll_result_view', {
    article_id: articleId,
    user_correct: userCorrect,
  })
}

export function trackNewsletterSubscribe(source) {
  gtag('event', 'newsletter_subscribe', { source }) // footer, article, popup
}

export function trackNewsletterDismiss(source) {
  gtag('event', 'newsletter_dismiss', { source })
}

export function trackConsumptionDashboard(action) {
  gtag('event', 'consumption_dashboard', { action }) // view, clear, share
}
