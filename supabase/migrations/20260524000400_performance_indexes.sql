-- ══════════════════════════════════════════════════════════
-- PERFORMANCE — Índices para resolver statement_timeout
-- ══════════════════════════════════════════════════════════
-- Error que el usuario reporta:
--   "canceling statement due to statement timeout"
-- Causa: la tabla `news` tiene >21K filas y las queries con
-- ILIKE sobre `category` (fetchNewsByCategory) o count(*) en
-- fetchSiteStats hacen sequential scan que excede los 8s del
-- PostgREST.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para acelerar ILIKE '%pattern%' sobre category.
-- Sin esto un ILIKE recorre toda la tabla.
CREATE INDEX IF NOT EXISTS idx_news_category_trgm
  ON news USING gin (category gin_trgm_ops);

-- Índice compuesto para queries country+published_at (el patrón
-- más común: filtrar por país y ordenar por fecha desc).
CREATE INDEX IF NOT EXISTS idx_news_country_published
  ON news (country_code, published_at DESC);

-- Índice por gemini_verdict (usado por fetchFlaggedNews y stats).
CREATE INDEX IF NOT EXISTS idx_news_gemini_verdict
  ON news (gemini_verdict)
  WHERE gemini_verdict IS NOT NULL;

-- Índice por sponsored_flag (fetchSponsoredNews).
CREATE INDEX IF NOT EXISTS idx_news_sponsored
  ON news (sponsored_flag)
  WHERE sponsored_flag IS NOT NULL;

-- Índice para acelerar stats: combinaciones country+gemini_validated
CREATE INDEX IF NOT EXISTS idx_news_country_validated
  ON news (country_code, gemini_validated);

-- ANALYZE para que el planner use las estadísticas frescas
ANALYZE news;
