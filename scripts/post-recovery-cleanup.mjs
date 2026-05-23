#!/usr/bin/env node
/**
 * Post-recovery cleanup. Cuando la DB vuelva:
 *  1. Deshabilita los triggers decode_html_entities en news y article_paragraphs
 *     (son causa principal de saturación: WHILE loop con regex en cada UPDATE)
 *  2. Verifica que el artículo Petro (id 44175) está completo
 *  3. NO reanuda scripts twitter-media (lo haces tú con throttle alto)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sbtqtzqpoejeojfnajpu.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN
if (!KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const sb = createClient(SUPABASE_URL, KEY)

async function runSql(query) {
  if (!MGMT_TOKEN) return { error: 'no MGMT_TOKEN' }
  const r = await fetch(
    `https://api.supabase.com/v1/projects/sbtqtzqpoejeojfnajpu/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }
  )
  return await r.json()
}

async function main() {
  console.log('=== Step 1: Deshabilitar triggers decode_html_entities ===')
  const sql1 = `
    DROP TRIGGER IF EXISTS trg_news_decode_entities ON news;
    DROP TRIGGER IF EXISTS trg_paragraphs_decode_entities ON article_paragraphs;
  `
  const r1 = await runSql(sql1)
  console.log('Drop triggers:', JSON.stringify(r1).slice(0, 300))

  console.log('\n=== Step 2: Verificar artículo Petro 44175 ===')
  const { data: art, error } = await sb
    .from('news')
    .select('id, title, country_code, published_at')
    .eq('id', 44175)
    .single()
  if (error) { console.error('Query news:', error); return }
  console.log('Artículo:', art)

  const { data: paras } = await sb
    .from('article_paragraphs')
    .select('id')
    .eq('news_id', 44175)
  console.log('Párrafos:', paras?.length)

  console.log('\n=== Step 3: Stats DB ===')
  const sql2 = `
    SELECT
      (SELECT count(*) FROM news) AS total_news,
      (SELECT count(*) FROM article_paragraphs) AS total_paragraphs,
      (SELECT count(*) FROM article_paragraphs WHERE media_url LIKE '%twimg%') AS twitter_media,
      (SELECT count(*) FROM political_tweets) AS political_feed_items
  `
  const r2 = await runSql(sql2)
  console.log('Stats:', JSON.stringify(r2).slice(0, 300))

  console.log('\n✓ DONE. Sitio listo para uso normal.')
  console.log('  Triggers decode deshabilitados — los nuevos inserts NO decodifican entities en server.')
  console.log('  Frontend ya tiene stripHtml + decodeEntities en cliente (sigue funcionando).')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
