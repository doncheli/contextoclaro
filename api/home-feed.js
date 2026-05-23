// Vercel Edge API: cachea el resultado del RPC get_home_feed.
// El RPC en sí ejecuta en ~38ms en Supabase, pero el round-trip total
// llega a 700-1400ms por DNS+TLS+cold-start. Con esta cache edge:
//
//   - Cache HIT: ~30ms (servido desde edge de Vercel)
//   - Cache MISS: ~200-400ms (1 round-trip a Supabase + serve)
//   - Stale-while-revalidate: usuarios siempre ven la versión cacheada,
//     mientras el edge actualiza en background

export const config = { runtime: 'edge' }

const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw'

export default async function handler(req) {
  const url = new URL(req.url)
  const country = (url.searchParams.get('country') || 'ALL').slice(0, 8)
  const heroLimit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('hero') || '4', 10)))
  const dailyLimit = Math.min(40, Math.max(1, parseInt(url.searchParams.get('daily') || '20', 10)))
  const feedLimit = Math.min(60, Math.max(1, parseInt(url.searchParams.get('feed') || '30', 10)))

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_home_feed`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_country: country,
        p_hero_limit: heroLimit,
        p_daily_limit: dailyLimit,
        p_feed_limit: feedLimit,
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'upstream_error', status: resp.status }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          // Cache negativo corto para no martillear cuando hay error
          'Cache-Control': 'public, s-maxage=10',
        },
      })
    }

    const data = await resp.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        // Browser cache mínimo — siempre re-pregunta al edge (browser hit es overkill)
        'Cache-Control': 'public, max-age=10, must-revalidate',
        // Vercel Edge: 30s fresh + 5 min stale-while-revalidate.
        // Garantiza máximo 30s entre noticia nueva ingestada y aparición a usuarios.
        // SWR alto: si el origen falla, sigue sirviendo cache hasta 5 min mientras retry.
        'Vercel-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
        // CDN downstream (Cloudflare cuando esté activo) — alineado: 30s fresh.
        'CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
        'Vary': 'Accept-Encoding',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'timeout', message: String(e).slice(0, 100) }), {
      status: 504,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=5',
      },
    })
  }
}
