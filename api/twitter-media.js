// Vercel Edge API: resuelve pic.twitter.com/SLUG → tweet ID → media (foto/video)
// Usa el endpoint público de syndication de X. Funciona desde Vercel Edge
// (Twitter no bloquea ese rango de IPs como bloquea a Supabase Functions).
//
// GET /api/twitter-media?slug=PpEwghap8r
// GET /api/twitter-media?id=1234567890

export const config = { runtime: 'edge' }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function resolveSlug(slug) {
  // Intento 1: HEAD con redirect manual
  for (const method of ['HEAD', 'GET']) {
    try {
      const resp = await fetch(`https://pic.twitter.com/${slug}`, {
        method,
        redirect: 'manual',
        headers: {
          'User-Agent': UA,
          'Accept': method === 'GET' ? 'text/html,*/*' : '*/*',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      })
      const loc = resp.headers.get('location')
      if (loc) {
        const m = loc.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i)
        if (m) return { user: m[1], id: m[2] }
      }
      if (resp.url) {
        const m = resp.url.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i)
        if (m) return { user: m[1], id: m[2] }
      }
    } catch { /* siguiente */ }
  }
  // Fallback: follow + URL final
  try {
    const resp = await fetch(`https://pic.twitter.com/${slug}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    })
    const m = resp.url.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i)
    if (m) return { user: m[1], id: m[2] }
  } catch { /* fail */ }
  return null
}

async function fetchTweetMedia(id) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=es&token=4`
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  })
  if (!resp.ok) return { ok: false, media: [], error: `syndication HTTP ${resp.status}` }
  const data = await resp.json()
  const media = []
  for (const m of data.mediaDetails || []) {
    if (m.type === 'photo') {
      media.push({ type: 'photo', url: m.media_url_https, width: m.sizes?.large?.w, height: m.sizes?.large?.h })
    } else if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = (m.video_info?.variants || [])
        .filter(v => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
      const best = variants[0]
      if (best) {
        media.push({
          type: m.type === 'animated_gif' ? 'gif' : 'video',
          url: best.url,
          poster: m.media_url_https,
        })
      }
    }
  }
  return {
    ok: true,
    tweet_id: id,
    user: data.user?.screen_name,
    text: data.text || '',
    media,
  }
}

export default async function handler(req) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')?.replace(/[^A-Za-z0-9]/g, '')
  let id = url.searchParams.get('id')?.replace(/[^0-9]/g, '')

  if (!slug && !id) {
    return new Response(JSON.stringify({ ok: false, error: 'slug or id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (slug && !id) {
    const r = await resolveSlug(slug)
    if (!r) {
      return new Response(JSON.stringify({ ok: false, media: [], error: 'slug not resolvable' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache negativo corto (10 min) en CDN
          'Cache-Control': 'public, s-maxage=600',
        },
      })
    }
    id = r.id
  }

  const result = await fetchTweetMedia(id)

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // CDN cache 24h, browser 1h
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
