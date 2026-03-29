/**
 * Fallback images by category/keyword for news without og:image.
 * Uses Unsplash Source (free, no API key needed).
 */

const CATEGORY_IMAGES = {
  // Politics
  politica: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=640&q=80',
  gobierno: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=640&q=80',
  elecciones: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=640&q=80',
  congreso: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=640&q=80',
  asamblea: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=640&q=80',

  // Economy
  economia: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=640&q=80',
  finanzas: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=640&q=80',
  mercado: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=640&q=80',
  petroleo: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=640&q=80',
  inflacion: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=640&q=80',

  // Security / Crime
  seguridad: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=640&q=80',
  crimen: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=640&q=80',
  policia: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=640&q=80',
  militar: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=640&q=80',
  defensa: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=640&q=80',

  // Technology
  tecnologia: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=640&q=80',
  digital: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=640&q=80',

  // Health
  salud: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=640&q=80',
  hospital: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=640&q=80',
  vacuna: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=640&q=80',

  // Sports
  deporte: 'https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=640&q=80',
  beisbol: 'https://images.unsplash.com/photo-1529768167801-9173d94c2a42?w=640&q=80',
  futbol: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=640&q=80',

  // Education
  educacion: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=640&q=80',
  universidad: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=640&q=80',

  // Environment
  ambiente: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=640&q=80',
  clima: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=640&q=80',

  // Energy
  energia: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=640&q=80',
  mineria: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=640&q=80',

  // International
  internacional: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=640&q=80',
  eeuu: 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=640&q=80',
  trump: 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=640&q=80',

  // Justice
  justicia: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=640&q=80',
  tribunal: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=640&q=80',
  juicio: 'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=640&q=80',

  // Entertainment
  cine: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=640&q=80',
  musica: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=640&q=80',
  cultura: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=640&q=80',

  // Country defaults
  venezuela: 'https://images.unsplash.com/photo-1589519160732-57fc498494f8?w=640&q=80',
  colombia: 'https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d?w=640&q=80',
}

// Generic fallback
const GENERIC_FALLBACK = 'https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=640&q=80'

/**
 * Get a fallback image URL based on news category, title, and country.
 */
export function getFallbackImage(news) {
  const text = `${news.category || ''} ${news.title || ''}`.toLowerCase()

  for (const [keyword, url] of Object.entries(CATEGORY_IMAGES)) {
    if (text.includes(keyword)) return url
  }

  // Country fallback
  if (news.countryCode === 'VE' || text.includes('venezuela')) return CATEGORY_IMAGES.venezuela
  if (news.countryCode === 'CO' || text.includes('colombia')) return CATEGORY_IMAGES.colombia

  return GENERIC_FALLBACK
}
