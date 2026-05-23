-- ══════════════════════════════════════════════════════════
-- STATS — RPC function que devuelve los counters en 1 query
-- ══════════════════════════════════════════════════════════
-- Reemplaza al cliente que cargaba toda la tabla para contar.
-- Una sola pasada usando COUNT(*) FILTER (...).

CREATE OR REPLACE FUNCTION get_site_stats(country_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  total          BIGINT,
  verified       BIGINT,
  misleading     BIGINT,
  fake           BIGINT,
  sponsored      BIGINT,
  bias_left      BIGINT,
  bias_center    BIGINT,
  bias_right     BIGINT,
  ai_validated   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE gemini_verdict = 'real') AS verified,
    COUNT(*) FILTER (WHERE gemini_verdict = 'misleading') AS misleading,
    COUNT(*) FILTER (WHERE gemini_verdict = 'fake') AS fake,
    COUNT(*) FILTER (WHERE sponsored_flag IS NOT NULL) AS sponsored,
    COUNT(*) FILTER (WHERE bias_label = 'IZQUIERDA') AS bias_left,
    COUNT(*) FILTER (WHERE bias_label IN ('CENTRO', 'EQUILIBRADO')) AS bias_center,
    COUNT(*) FILTER (WHERE bias_label = 'DERECHA') AS bias_right,
    COUNT(*) FILTER (WHERE gemini_validated = TRUE) AS ai_validated
  FROM news
  WHERE
    CASE
      WHEN country_filter IS NULL OR country_filter = 'ALL' THEN country_code IN ('VE', 'CO', 'TECH')
      ELSE country_code = country_filter
    END;
$$;

GRANT EXECUTE ON FUNCTION get_site_stats(TEXT) TO anon, authenticated;
