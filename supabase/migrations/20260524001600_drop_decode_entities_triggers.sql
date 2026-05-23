-- ══════════════════════════════════════════════════════════
-- ROLLBACK del trigger decode_html_entities
-- ══════════════════════════════════════════════════════════
-- Causa raíz del incidente DB-down (2026-05-23): el trigger ejecutaba
-- un WHILE loop con regex (~25 replaces + numeric entity loop hasta 1000
-- iters) en CADA INSERT/UPDATE. Con los scripts de twitter-media haciendo
-- updates concurrentes masivos, satura CPU y agota el pool de conexiones.
--
-- El backfill ya decodificó ~9.5K noticias y ~33K párrafos. Los nuevos
-- inserts confiarán en la decodificación CLIENTE en src/lib/newsService.js
-- (stripHtml + decodeEntities), que es suficiente.

DROP TRIGGER IF EXISTS trg_news_decode_entities ON news;
DROP TRIGGER IF EXISTS trg_paragraphs_decode_entities ON article_paragraphs;
DROP FUNCTION IF EXISTS news_decode_entities_trigger() CASCADE;
DROP FUNCTION IF EXISTS paragraph_decode_entities_trigger() CASCADE;
DROP FUNCTION IF EXISTS decode_html_entities(TEXT) CASCADE;
