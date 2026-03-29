const STORAGE_KEY = 'cc_reads'
const MAX_ENTRIES = 500

export function trackRead(news) {
  if (!news?.id) return
  try {
    const reads = getReads()
    // Avoid duplicate tracking for same article
    if (reads.some(r => r.id === news.id)) return
    reads.push({
      id: news.id,
      ts: Date.now(),
      bias: news.bias ? (news.bias.left > news.bias.right ? 'izquierda' : news.bias.right > news.bias.left ? 'derecha' : 'centro') : 'centro',
      biasRaw: news.bias || { left: 0, center: 100, right: 0 },
      country: news.countryCode || 'VE',
      source: news.sourceLabel || news.source || '',
      category: (news.category || '').split(' · ').pop() || 'GENERAL',
    })
    // Keep rolling window
    const trimmed = reads.slice(-MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch { /* localStorage full or unavailable */ }
}

export function getReads() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

export function getConsumptionStats() {
  const reads = getReads()
  if (reads.length === 0) return null

  // Bias distribution
  const biasCount = { izquierda: 0, centro: 0, derecha: 0 }
  const biasAccum = { left: 0, center: 0, right: 0 }
  const sourceCount = {}
  const countryCount = {}
  const categoryCount = {}

  reads.forEach(r => {
    biasCount[r.bias] = (biasCount[r.bias] || 0) + 1
    if (r.biasRaw) {
      biasAccum.left += r.biasRaw.left || 0
      biasAccum.center += r.biasRaw.center || 0
      biasAccum.right += r.biasRaw.right || 0
    }
    sourceCount[r.source] = (sourceCount[r.source] || 0) + 1
    countryCount[r.country] = (countryCount[r.country] || 0) + 1
    categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
  })

  const total = reads.length
  const biasTotal = biasAccum.left + biasAccum.center + biasAccum.right || 1

  // Top sources
  const topSources = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round(count / total * 100) }))

  // Recommendation
  const biasLeft = Math.round(biasAccum.left / biasTotal * 100)
  const biasCenter = Math.round(biasAccum.center / biasTotal * 100)
  const biasRight = Math.round(biasAccum.right / biasTotal * 100)

  let recommendation = ''
  if (biasRight > 60) recommendation = 'Tu consumo se inclina a la derecha. Prueba leer fuentes de centro-izquierda para equilibrar tu perspectiva.'
  else if (biasLeft > 60) recommendation = 'Tu consumo se inclina a la izquierda. Prueba leer fuentes de centro-derecha para ampliar tu visión.'
  else if (biasCenter > 80) recommendation = 'Lees mayormente fuentes de centro. Excelente equilibrio, pero también es útil conocer las perspectivas de izquierda y derecha.'
  else recommendation = 'Tu consumo de noticias está bastante equilibrado. ¡Sigue así!'

  return {
    total,
    bias: { left: biasLeft, center: biasCenter, right: biasRight },
    biasCount,
    topSources,
    countries: Object.entries(countryCount).map(([code, count]) => ({ code, count, pct: Math.round(count / total * 100) })),
    categories: Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count, pct: Math.round(count / total * 100) })),
    recommendation,
    since: reads[0]?.ts ? new Date(reads[0].ts).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
  }
}

export function clearConsumption() {
  localStorage.removeItem(STORAGE_KEY)
}
