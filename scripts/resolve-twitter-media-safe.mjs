#!/usr/bin/env node
/**
 * VERSIÓN SEGURA del backfill twitter-media — diseñada para NO saturar la DB.
 *
 * Cambios vs versiones anteriores:
 *  - 1 fetch a la vez (sin paralelismo)
 *  - 2s entre fetches a Twitter (vs 250ms antes)
 *  - Pausa de 30s cada 30 párrafos procesados (cooling)
 *  - 1 UPDATE a la vez con 200ms delay (sin Promise.all en chunks de 25)
 *  - Solo procesa lo que NO tenga media_url ni TWEET_DELETED
 *  - Si hay 3 errores consecutivos de DB, pausa 60s y reintenta
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/resolve-twitter-media-safe.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SERVICE_KEY)
const UA_RESOLVE = 'curl/7.79.1'
const UA_API = 'Mozilla/5.0'

// Configuración conservadora
const TWITTER_THROTTLE_MS = 2000      // 2s entre llamadas a Twitter
const DB_THROTTLE_MS = 200            // 200ms entre operaciones DB
const COOLING_EVERY = 30              // Pausa larga cada N párrafos
const COOLING_MS = 30000              // 30s de pausa
const RETRY_AFTER_DB_FAIL_MS = 60000  // 60s si la DB empieza a fallar

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function resolveSlug(slug) {
  try {
    const resp = await fetch(`https://pic.twitter.com/${slug}`, {
      method: 'GET', redirect: 'manual',
      headers: { 'User-Agent': UA_RESOLVE, 'Accept': '*/*' },
      signal: AbortSignal.timeout(8000),
    })
    const loc = resp.headers.get('location')
    if (!loc) {
      // 404 / sin redirect = tweet borrado o slug inválido
      return resp.status === 404 ? { deleted: true } : null
    }
    const m = loc.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i)
    return m ? { user: m[1], id: m[2] } : null
  } catch { return null }
}

async function fetchMedia(id) {
  try {
    const resp = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=es&token=4`, {
      headers: { 'User-Agent': UA_API, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
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
    return { user: data.user?.screen_name, media: out }
  } catch { return null }
}

const PIC_RE = /pic\.twitter\.com\/([A-Za-z0-9]+)/g

async function safeDbCall(fn, label) {
  let attempt = 0
  while (true) {
    try {
      const r = await fn()
      if (r?.error) throw r.error
      return r
    } catch (e) {
      attempt++
      console.warn(`  ⚠ DB error en ${label} (intento ${attempt}): ${e?.message?.slice(0, 80)}`)
      if (attempt >= 3) {
        console.warn(`  → Pausa de ${RETRY_AFTER_DB_FAIL_MS / 1000}s para que la DB se calme`)
        await sleep(RETRY_AFTER_DB_FAIL_MS)
        attempt = 0
      } else {
        await sleep(2000 * attempt)
      }
    }
  }
}

async function main() {
  const direction = process.argv[2] === 'desc' ? 'desc' : 'asc'
  console.log(`SAFE backfill — direction=${direction}, twitter_throttle=${TWITTER_THROTTLE_MS}ms, db_throttle=${DB_THROTTLE_MS}ms`)

  let processed = 0, resolved = 0, embedded = 0, deleted = 0, failed = 0
  const seenSlugs = new Map()

  let cursor = direction === 'desc'
    ? ((await sb.from('article_paragraphs').select('id').order('id', { ascending: false }).limit(1).single()).data?.id || 0) + 1
    : 0

  while (true) {
    // Leer un lote de 200 (chico) para minimizar memoria y lock time
    const r = await safeDbCall(
      () => direction === 'desc'
        ? sb.from('article_paragraphs').select('id, news_id, content, sort_order, media_url, media_caption').lt('id', cursor).order('id', { ascending: false }).limit(200)
        : sb.from('article_paragraphs').select('id, news_id, content, sort_order, media_url, media_caption').gt('id', cursor).order('id', { ascending: true }).limit(200),
      'fetch_batch',
    )
    if (!r.data || r.data.length === 0) break
    cursor = r.data[r.data.length - 1].id

    // Solo los que tengan pic.twitter.com, sin media y sin marca DELETED
    const filtered = r.data.filter(p =>
      p.content && p.content.includes('pic.twitter.com/') &&
      !p.media_url && p.media_caption !== 'TWEET_DELETED'
    )

    for (const p of filtered) {
      processed++
      const slugs = [...new Set([...p.content.matchAll(PIC_RE)].map(m => m[1]))]
      if (slugs.length === 0) continue

      let firstResolved = null
      let allFailed = true
      let extraMedia = []

      for (const slug of slugs) {
        let cached = seenSlugs.get(slug)
        if (cached === undefined) {
          const res = await resolveSlug(slug)
          await sleep(TWITTER_THROTTLE_MS)
          if (res?.deleted) {
            seenSlugs.set(slug, 'deleted')
            deleted++
            continue
          }
          if (!res) {
            seenSlugs.set(slug, null)
            failed++
            continue
          }
          const media = await fetchMedia(res.id)
          await sleep(TWITTER_THROTTLE_MS)
          cached = media && media.media.length > 0 ? media : null
          seenSlugs.set(slug, cached)
          if (cached) resolved++
        } else if (cached === 'deleted') {
          continue
        }
        if (!cached) continue
        allFailed = false
        if (!firstResolved) firstResolved = cached
        else extraMedia.push(...cached.media)
      }

      // Si TODOS los slugs son deleted/inválidos: marcar el párrafo
      if (allFailed && !firstResolved) {
        // Solo marcar como DELETED si al menos un slug devolvió 404
        const someDeleted = slugs.some(s => seenSlugs.get(s) === 'deleted')
        if (someDeleted) {
          await safeDbCall(
            () => sb.from('article_paragraphs').update({ media_caption: 'TWEET_DELETED' }).eq('id', p.id),
            'mark_deleted',
          )
          await sleep(DB_THROTTLE_MS)
        }
        continue
      }

      if (firstResolved) {
        const first = firstResolved.media[0]
        await safeDbCall(
          () => sb.from('article_paragraphs').update({
            media_type: first.type,
            media_url: first.url,
            media_caption: firstResolved.user ? `Tweet de @${firstResolved.user}` : null,
          }).eq('id', p.id),
          'update_media',
        )
        await sleep(DB_THROTTLE_MS)
        embedded++

        // Resto de media (incluyendo de otros slugs del mismo párrafo)
        const allExtra = [...firstResolved.media.slice(1), ...extraMedia]
        if (allExtra.length) {
          const { data: maxRow } = await safeDbCall(
            () => sb.from('article_paragraphs').select('sort_order').eq('news_id', p.news_id).order('sort_order', { ascending: false }).limit(1).single(),
            'fetch_max',
          )
          let nextSort = (maxRow?.sort_order || p.sort_order) + 1
          for (const m of allExtra) {
            await safeDbCall(
              () => sb.from('article_paragraphs').insert({
                news_id: p.news_id, sort_order: nextSort++, content: '',
                media_type: m.type, media_url: m.url,
                media_caption: firstResolved.user ? `Tweet de @${firstResolved.user}` : null,
              }),
              'insert_extra',
            )
            await sleep(DB_THROTTLE_MS)
          }
        }
      }

      if (processed % 10 === 0) {
        console.log(`  procesados=${processed} resueltos=${resolved} embebidos=${embedded} 404=${deleted} fallidos=${failed} unique=${seenSlugs.size}`)
      }

      // Cooling cada N párrafos
      if (processed % COOLING_EVERY === 0) {
        console.log(`  ⏸  Cooling ${COOLING_MS / 1000}s para no saturar la DB…`)
        await sleep(COOLING_MS)
      }
    }
  }

  console.log('\n=== RESUMEN SAFE ===')
  console.log(`Procesados: ${processed}, Resueltos: ${resolved}, Embebidos: ${embedded}, 404: ${deleted}, Fallidos: ${failed}`)
  console.log(`Slugs únicos vistos: ${seenSlugs.size}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
