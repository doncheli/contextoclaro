-- ══════════════════════════════════════════════════════════
-- PERFORMANCE — Índices para las queries calientes de la home
-- ══════════════════════════════════════════════════════════
-- Objetivo: que hero/daily/feed/blindspot y la paginación se
-- resuelvan por índice (index-only / index scan) en vez de
-- escaneo+sort, eliminando los "statement timeout" en horas pico.
--
-- Patrón de las queries (newsService.js + get_home_feed):
--   WHERE news_type [IN/=] ... AND country_code [IN/=] ...
--   ORDER BY published_at DESC LIMIT n
--   (hero además exige image IS NOT NULL)
--
-- Aplicar en el proyecto de PRODUCCIÓN (sbtqtzqpoejeojfnajpu):
--   - Supabase Studio → SQL Editor → pegar y ejecutar, o
--   - supabase link --project-ref sbtqtzqpoejeojfnajpu && supabase db push

-- daily / feed / blindspot: filtran news_type + country y ordenan por fecha.
-- Índice compuesto que cubre el filtro completo y el orden.
CREATE INDEX IF NOT EXISTS idx_news_type_country_published
  ON news (news_type, country_code, published_at DESC);

-- Hero: country + fecha pero SOLO filas con imagen (image IS NOT NULL).
-- Índice parcial: mucho más pequeño y exacto para esa query.
CREATE INDEX IF NOT EXISTS idx_news_hero
  ON news (country_code, published_at DESC)
  WHERE image IS NOT NULL;

-- Refrescar estadísticas del planner para que use los índices nuevos.
ANALYZE news;
