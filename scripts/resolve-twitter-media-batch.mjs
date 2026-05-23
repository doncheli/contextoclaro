#!/usr/bin/env node
/**
 * Backfill: resuelve pic.twitter.com/SLUG en article_paragraphs.content
 * usando IP residencial (Twitter bloquea ranges de Supabase/Vercel datacenters).
 *
 * Para cada slug encontrado:
 *   1. HEAD pic.twitter.com/SLUG → location → tweet ID
 *   2. GET syndication → media URLs
 *   3. INSERT párrafo nuevo con media_type=image|video y media_url
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/resolve-twitter-media-batch.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
// Importante: Cloudflare bloquea browser UAs sin TLS fingerprint completo,
// pero permite curl. Usar UA tipo "curl/" para que pic.twitter.com devuelva 301.
const UA_RESOLVE = 'curl/7.79.1'
const UA_API = 'Mozilla/5.0'

async function resolveSlug(slug) {
  try {
    const resp = await fetch(`https://pic.twitter.com/${slug}`, {
      method: 'GET', redirect: 'manual',
      headers: { 'User-Agent': UA_RESOLVE, 'Accept': '*/*' },
    })
    const loc = resp.headers.get('location')
    if (!loc) return null
    const m = loc.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i)
    return m ? { user: m[1], id: m[2] } : null
  } catch { return null }
}

async function fetchMedia(id) {
  try {
    const resp = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=es&token=4`, {
      headers: { 'User-Agent': UA_API, 'Accept': 'application/json' },
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const out = []
    for (const m of data.mediaDetails || []) {
      if (m.type === 'photo') {
        out.push({ type: 'image', url: m.media_url_https })
      } else if (m.type === 'video' || m.type === 'animated_gif') {
        const v = (m.video_info?.variants || [])
          .filter(x => x.content_type === 'video/mp4')
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
        if (v) out.push({ type: 'video', url: v.url, poster: m.media_url_https })
      }
    }
    return { user: data.user?.screen_name, text: data.text, media: out }
  } catch { return null }
}

const PIC_RE = /pic\.twitter\.com\/([A-Za-z0-9]+)/g

async function main() {
  console.log('Cargando párrafos con pic.twitter.com…')
  // Paginar: PostgREST capa 1000 por request
  let processed = 0, found = 0, updated = 0, failed = 0
  const seenSlugs = new Map() // slug → result cached

  // Paginar por id ascendente sin ilike (statement_timeout). Filtrar en cliente.
  let lastId = 0
  while (true) {
    const { data, error } = await supabase
      .from('article_paragraphs')
      .select('id, news_id, content, sort_order, media_type, media_url')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(1000)
    if (error) { console.error('Query error:', error); break }
    if (!data || data.length === 0) break
    lastId = data[data.length - 1].id
    // Filtrar en cliente para no recargar el servidor
    const dataFiltered = data.filter(p => p.content && p.content.includes('pic.twitter.com/'))
    // sustituimos la variable para el resto del loop
    data.length = 0
    data.push(...dataFiltered)

    for (const p of data) {
      processed++
      if (p.media_url) continue // ya procesado

      const slugs = [...new Set([...p.content.matchAll(PIC_RE)].map(m => m[1]))]
      if (slugs.length === 0) continue
      found++

      let allFailed = true
      for (const slug of slugs) {
        let resolved = seenSlugs.get(slug)
        if (resolved === undefined) {
          const r = await resolveSlug(slug)
          if (!r) {
            seenSlugs.set(slug, null)
            continue
          }
          const m = await fetchMedia(r.id)
          resolved = m && m.media.length > 0 ? m : null
          seenSlugs.set(slug, resolved)
          await new Promise(r => setTimeout(r, 250))
        }
        if (!resolved) { failed++; continue }
        allFailed = false

        // Update el párrafo actual con media (smallint sort_order no permite decimales)
        // Si ya hubiera media en otro párrafo lo dejamos; si no, asignamos al actual.
        // Para múltiples media en un solo tweet, ponemos los extras como párrafos
        // nuevos con sort_order = max + n.
        const firstMedia = resolved.media[0]
        const { error: upErr } = await supabase.from('article_paragraphs').update({
          media_type: firstMedia.type,
          media_url: firstMedia.url,
          media_caption: resolved.user ? `Tweet de @${resolved.user}` : null,
        }).eq('id', p.id)
        if (upErr) {
          console.warn('  ↳ update error:', upErr.message?.slice(0, 100))
        } else {
          updated++
        }
        // Resto de media: append al final
        if (resolved.media.length > 1) {
          const { data: maxRow } = await supabase.from('article_paragraphs')
            .select('sort_order').eq('news_id', p.news_id)
            .order('sort_order', { ascending: false }).limit(1).single()
          let nextSort = (maxRow?.sort_order || p.sort_order) + 1
          for (let mi = 1; mi < resolved.media.length; mi++) {
            const m = resolved.media[mi]
            await supabase.from('article_paragraphs').insert({
              news_id: p.news_id,
              sort_order: nextSort++,
              content: '',
              media_type: m.type,
              media_url: m.url,
              media_caption: resolved.user ? `Tweet de @${resolved.user}` : null,
              media_alt: null,
            })
          }
        }
      }

      if (allFailed && slugs.length > 0) {
        await supabase.from('article_paragraphs')
          .update({ media_caption: 'TWEET_DELETED' })
          .eq('id', p.id)
      }

      if (found % 10 === 0) {
        console.log(`  scanned=${processed} con_pic=${found} embeded=${updated} failed=${failed} slugs_únicos=${seenSlugs.size}`)
      }
    }

  }

  console.log('\n=== RESUMEN ===')
  console.log(`Párrafos escaneados: ${processed}`)
  console.log(`Con pic.twitter.com: ${found}`)
  console.log(`Slugs únicos: ${seenSlugs.size}`)
  console.log(`Slugs resueltos a media: ${[...seenSlugs.values()].filter(Boolean).length}`)
  console.log(`Media-rows insertadas: ${updated}`)
  console.log(`Slugs fallidos: ${failed}`)
}

main().catch(console.error)
