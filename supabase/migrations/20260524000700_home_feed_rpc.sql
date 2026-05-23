-- ══════════════════════════════════════════════════════════
-- RPC — get_home_feed: TODO el feed crítico en UNA query
-- ══════════════════════════════════════════════════════════
-- Reemplaza 4-12 round-trips por uno solo.
-- Útil sobre todo en mobile (alta latencia).

CREATE OR REPLACE FUNCTION get_home_feed(
  p_country TEXT DEFAULT 'ALL',
  p_hero_limit INT DEFAULT 4,
  p_daily_limit INT DEFAULT 20,
  p_feed_limit INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  countries TEXT[];
BEGIN
  -- Determinar países a incluir
  IF p_country IS NULL OR p_country = 'ALL' THEN
    countries := ARRAY['VE', 'CO', 'TECH'];
  ELSE
    countries := ARRAY[p_country];
  END IF;

  -- Construir el JSON con todo el feed
  WITH hero_news AS (
    SELECT to_jsonb(t.*) AS j FROM (
      SELECT id, news_type, title, description, category, country, country_code,
             image, read_time, author, bias_left, bias_center, bias_right, bias_label,
             credibility, source_count, veracity, veracity_detail, sponsored_flag,
             source_label, time_label,
             score_factual, score_source_div, score_transparency, score_independence,
             gemini_validated, gemini_verdict, gemini_confidence, gemini_reasoning,
             published_at
      FROM news
      WHERE country_code = ANY(countries)
        AND image IS NOT NULL
        AND image NOT LIKE '%googleusercontent%'
      ORDER BY published_at DESC
      LIMIT p_hero_limit
    ) t
  ),
  daily_news AS (
    SELECT to_jsonb(t.*) AS j FROM (
      SELECT id, news_type, title, description, category, country, country_code,
             image, read_time, source_count, bias_label,
             gemini_verdict, gemini_confidence,
             score_factual, score_source_div, score_transparency, score_independence,
             veracity, sponsored_flag, source_label, published_at
      FROM news
      WHERE country_code = ANY(countries)
        AND news_type IN ('daily', 'feed')
      ORDER BY published_at DESC
      LIMIT p_daily_limit
    ) t
  ),
  feed_news AS (
    SELECT to_jsonb(t.*) AS j FROM (
      SELECT id, news_type, title, description, category, country, country_code,
             image, source_label, time_label, source_count,
             bias_label, gemini_verdict, gemini_confidence,
             veracity, sponsored_flag, published_at
      FROM news
      WHERE country_code = ANY(countries)
        AND news_type = 'feed'
      ORDER BY published_at DESC
      LIMIT p_feed_limit
    ) t
  ),
  stats_data AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE gemini_verdict = 'real') AS verified,
      COUNT(*) FILTER (WHERE gemini_verdict = 'misleading') AS misleading,
      COUNT(*) FILTER (WHERE gemini_verdict = 'fake') AS fake,
      COUNT(*) FILTER (WHERE sponsored_flag IS NOT NULL) AS sponsored,
      COUNT(*) FILTER (WHERE bias_label = 'IZQUIERDA') AS bias_left,
      COUNT(*) FILTER (WHERE bias_label IN ('CENTRO','EQUILIBRADO')) AS bias_center,
      COUNT(*) FILTER (WHERE bias_label = 'DERECHA') AS bias_right,
      COUNT(*) FILTER (WHERE gemini_validated = TRUE) AS ai_validated
    FROM news
    WHERE country_code = ANY(countries)
  )
  SELECT jsonb_build_object(
    'hero', COALESCE((SELECT jsonb_agg(j) FROM hero_news), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(j) FROM daily_news), '[]'::jsonb),
    'feed', COALESCE((SELECT jsonb_agg(j) FROM feed_news), '[]'::jsonb),
    'stats', (SELECT to_jsonb(stats_data.*) FROM stats_data)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(TEXT, INT, INT, INT) TO anon, authenticated;
