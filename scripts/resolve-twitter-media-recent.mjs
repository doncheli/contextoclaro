#!/usr/bin/env node
/**
 * Variante que procesa primero los IDs MÁS ALTOS (noticias más recientes)
 * para que el usuario las vea ya. Misma lógica que el batch pero descendente.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
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
  console.log('Procesando IDs MÁS ALTOS primero (noticias recientes)…')
  let processed = 0, found = 0, updated = 0, failed = 0
  const seenSlugs = new Map()

  // Empezamos desde el MAX real y bajamos
  const { data: maxRow } = await supabase.from('article_paragraphs')
    .select('id').order('id', { ascending: false }).limit(1).single()
  let highId = (maxRow?.id || 999999999) + 1
  while (true) {
    const { data, error } = await supabase
      .from('article_paragraphs')
      .select('id, news_id, content, sort_order, media_type, media_url')
      .lt('id', highId)
      .order('id', { ascending: false })
      .limit(500)
    if (error) { console.error('Query:', error.message); break }
    if (!data || data.length === 0) break
    highId = data[data.length - 1].id
    const filtered = data.filter(p => p.content && p.content.includes('pic.twitter.com/') && !p.media_url)

    for (const p of filtered) {
      processed++
      const slugs = [...new Set([...p.content.matchAll(PIC_RE)].map(m => m[1]))]
      if (slugs.length === 0) continue
      found++

      // Si TODOS los slugs del párrafo fallan, marcar el párrafo como DELETED
      // para que el frontend no muestre CTAs inútiles.
      let allFailed = true
      for (const slug of slugs) {
        let resolved = seenSlugs.get(slug)
        if (resolved === undefined) {
          const r = await resolveSlug(slug)
          if (!r) { seenSlugs.set(slug, null); failed++; continue }
          const m = await fetchMedia(r.id)
          resolved = m && m.media.length > 0 ? m : null
          seenSlugs.set(slug, resolved)
          await new Promise(r => setTimeout(r, 200))
        }
        if (!resolved) { failed++; continue }
        allFailed = false

        const firstMedia = resolved.media[0]
        const { error: upErr } = await supabase.from('article_paragraphs').update({
          media_type: firstMedia.type,
          media_url: firstMedia.url,
          media_caption: resolved.user ? `Tweet de @${resolved.user}` : null,
        }).eq('id', p.id)
        if (!upErr) updated++

        // Resto de media: append al final
        if (resolved.media.length > 1) {
          const { data: maxRow } = await supabase.from('article_paragraphs')
            .select('sort_order').eq('news_id', p.news_id)
            .order('sort_order', { ascending: false }).limit(1).single()
          let nextSort = (maxRow?.sort_order || p.sort_order) + 1
          for (let mi = 1; mi < resolved.media.length; mi++) {
            const m = resolved.media[mi]
            await supabase.from('article_paragraphs').insert({
              news_id: p.news_id, sort_order: nextSort++, content: '',
              media_type: m.type, media_url: m.url,
              media_caption: resolved.user ? `Tweet de @${resolved.user}` : null,
            })
          }
        }
      }
      // Si ningún slug del párrafo se pudo resolver, marcar para que el
      // frontend no muestre CTA card para esa URL borrada/inválida.
      if (allFailed && slugs.length > 0) {
        await supabase.from('article_paragraphs')
          .update({ media_caption: 'TWEET_DELETED' })
          .eq('id', p.id)
      }

      if (found % 10 === 0) {
        console.log(`  scanned=${processed} con_pic=${found} embeded=${updated} failed=${failed} highId=${highId}`)
      }
    }
  }

  console.log('\n=== RESUMEN (recent first) ===')
  console.log(`Párrafos con pic procesados: ${processed}`)
  console.log(`Slugs únicos: ${seenSlugs.size}`)
  console.log(`Media-rows insertadas/actualizadas: ${updated}`)
  console.log(`Fallidos: ${failed}`)
}

main().catch(console.error)
