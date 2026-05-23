-- ══════════════════════════════════════════════════════════
-- PURGE — Eliminar noticias sin contenido real (Google News RSS stubs)
-- ══════════════════════════════════════════════════════════
-- Patrón: description que empieza con HTML escapado (&lt;a href...)
-- + source_url apuntando a news.google.com/rss/articles.
-- No tienen contenido scrapeado, solo el snippet del feed.
-- Bajan la calidad del sitio y AdSense las marca como "bajo valor".

-- 1) Borrar los stubs existentes
DELETE FROM news
WHERE description LIKE '%&lt;a href%'
   OR source_url LIKE 'https://news.google.com/rss/articles/%';

-- 2) Trigger preventivo: rechaza inserts/updates con description en formato RSS stub
CREATE OR REPLACE FUNCTION reject_empty_news_stubs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.description IS NOT NULL AND NEW.description LIKE '%&lt;a href%' THEN
    RAISE EXCEPTION 'news.description con HTML stub de RSS no permitido (id=%)', NEW.id;
  END IF;
  IF NEW.source_url IS NOT NULL AND NEW.source_url LIKE 'https://news.google.com/rss/articles/%' THEN
    RAISE EXCEPTION 'news.source_url apuntando a Google News RSS no permitido (id=%)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reject_empty_news_stubs ON news;
CREATE TRIGGER trg_reject_empty_news_stubs
  BEFORE INSERT OR UPDATE OF description, source_url ON news
  FOR EACH ROW EXECUTE FUNCTION reject_empty_news_stubs();
