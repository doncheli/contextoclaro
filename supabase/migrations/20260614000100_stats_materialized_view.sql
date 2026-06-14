-- ══════════════════════════════════════════════════════════
-- PERFORMANCE — Stats precomputadas (vista materializada)
-- ══════════════════════════════════════════════════════════
-- Problema: get_home_feed hace un COUNT(*) con 9 FILTER sobre TODA
-- la tabla (>21K filas) en CADA carga de la home — es la parte más
-- cara del critical path y agrava los "statement timeout".
-- Solución: precomputar las stats por país en una matview que se
-- refresca por cron cada 10 min; el RPC solo lee 1-3 filas.

-- 1) Matview con las stats agrupadas por país.
DROP MATERIALIZED VIEW IF EXISTS mv_news_stats;
CREATE MATERIALIZED VIEW mv_news_stats AS
  SELECT
    country_code,
    COUNT(*)                                                          AS total,
    COUNT(*) FILTER (WHERE gemini_verdict = 'real')                   AS verified,
    COUNT(*) FILTER (WHERE gemini_verdict = 'misleading')             AS misleading,
    COUNT(*) FILTER (WHERE gemini_verdict = 'fake')                   AS fake,
    COUNT(*) FILTER (WHERE sponsored_flag IS NOT NULL)                AS sponsored,
    COUNT(*) FILTER (WHERE bias_label = 'IZQUIERDA')                  AS bias_left,
    COUNT(*) FILTER (WHERE bias_label IN ('CENTRO','EQUILIBRADO'))    AS bias_center,
    COUNT(*) FILTER (WHERE bias_label = 'DERECHA')                    AS bias_right,
    COUNT(*) FILTER (WHERE gemini_validated = TRUE)                   AS ai_validated
  FROM news
  WHERE country_code IN ('VE','CO','TECH')
  GROUP BY country_code;

-- Índice único: requerido por REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_news_stats_cc ON mv_news_stats (country_code);

GRANT SELECT ON mv_news_stats TO anon, authenticated;

-- 2) get_home_feed v3: idéntico, pero stats salen de la matview (sin full-scan).
CREATE OR REPLACE FUNCTION get_home_feed(
  p_country TEXT DEFAULT 'ALL',
  p_hero_limit INT DEFAULT 4,
  p_daily_limit INT DEFAULT 20,
  p_feed_limit INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hero AS (
    SELECT
      id, news_type, title, description, category, country, country_code,
      image, read_time, author, bias_left, bias_center, bias_right, bias_label,
      credibility, source_count, veracity, veracity_detail, sponsored_flag,
      source_label, time_label,
      score_factual, score_source_div, score_transparency, score_independence,
      gemini_validated, gemini_verdict, gemini_confidence, gemini_reasoning,
      published_at
    FROM news
    WHERE CASE
      WHEN p_country IS NULL OR p_country = 'ALL' THEN country_code IN ('VE','CO','TECH')
      ELSE country_code = p_country
    END
    AND image IS NOT NULL
    AND image NOT LIKE '%googleusercontent%'
    ORDER BY published_at DESC
    LIMIT p_hero_limit
  ),
  daily AS (
    SELECT
      id, news_type, title, description, category, country, country_code,
      image, source_label, source_count, bias_label,
      gemini_verdict, gemini_confidence,
      score_factual, score_source_div, score_transparency, score_independence,
      veracity, sponsored_flag, published_at
    FROM news
    WHERE CASE
      WHEN p_country IS NULL OR p_country = 'ALL' THEN country_code IN ('VE','CO','TECH')
      ELSE country_code = p_country
    END
    AND news_type IN ('daily','feed')
    ORDER BY published_at DESC
    LIMIT p_daily_limit
  ),
  feed AS (
    SELECT
      id, news_type, title, description, category, country, country_code,
      image, source_label, time_label, source_count,
      bias_label, gemini_verdict, gemini_confidence,
      veracity, sponsored_flag, published_at
    FROM news
    WHERE CASE
      WHEN p_country IS NULL OR p_country = 'ALL' THEN country_code IN ('VE','CO','TECH')
      ELSE country_code = p_country
    END
    AND news_type = 'feed'
    ORDER BY published_at DESC
    LIMIT p_feed_limit
  ),
  stats AS (
    SELECT
      COALESCE(SUM(total), 0)        AS total,
      COALESCE(SUM(verified), 0)     AS verified,
      COALESCE(SUM(misleading), 0)   AS misleading,
      COALESCE(SUM(fake), 0)         AS fake,
      COALESCE(SUM(sponsored), 0)    AS sponsored,
      COALESCE(SUM(bias_left), 0)    AS bias_left,
      COALESCE(SUM(bias_center), 0)  AS bias_center,
      COALESCE(SUM(bias_right), 0)   AS bias_right,
      COALESCE(SUM(ai_validated), 0) AS ai_validated
    FROM mv_news_stats
    WHERE CASE
      WHEN p_country IS NULL OR p_country = 'ALL' THEN country_code IN ('VE','CO','TECH')
      ELSE country_code = p_country
    END
  )
  SELECT jsonb_build_object(
    'hero', COALESCE((SELECT jsonb_agg(to_jsonb(h.*)) FROM hero h), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d.*)) FROM daily d), '[]'::jsonb),
    'feed', COALESCE((SELECT jsonb_agg(to_jsonb(f.*)) FROM feed f), '[]'::jsonb),
    'stats', (SELECT to_jsonb(s.*) FROM stats s)
  );
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(TEXT, INT, INT, INT) TO anon, authenticated;

-- 3) Cron: refrescar la matview cada 10 min (requiere pg_cron, ya habilitado).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-news-stats-every-10min') THEN
    PERFORM cron.unschedule('refresh-news-stats-every-10min');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-news-stats-every-10min',
  '*/10 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_news_stats; $$
);
