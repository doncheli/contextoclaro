-- ══════════════════════════════════════════════════════════
-- TWITTER — Tablas de cache y feed político curado
-- ══════════════════════════════════════════════════════════

-- Cache genérico de búsquedas (evita consumir cuota de la X API)
CREATE TABLE IF NOT EXISTS twitter_cache (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cache_key   TEXT NOT NULL UNIQUE,
  query       TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_twitter_cache_created ON twitter_cache (created_at DESC);

ALTER TABLE twitter_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública cache" ON twitter_cache;
CREATE POLICY "Lectura pública cache" ON twitter_cache FOR SELECT USING (TRUE);

-- ══════════════════════════════════════════════════════════
-- Feed político curado — actualizado por cron
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS political_tweets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tweet_id      TEXT NOT NULL,
  country_code  TEXT NOT NULL CHECK (country_code IN ('VE','CO')),
  text          TEXT NOT NULL,
  lang          TEXT,
  author_name   TEXT,
  author_handle TEXT,
  author_avatar TEXT,
  author_verified BOOLEAN DEFAULT FALSE,
  media         JSONB,
  metrics       JSONB,
  url           TEXT,
  tweet_created_at TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tweet_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_political_tweets_country_created
  ON political_tweets (country_code, tweet_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_political_tweets_fetched
  ON political_tweets (fetched_at DESC);

ALTER TABLE political_tweets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública tweets" ON political_tweets;
CREATE POLICY "Lectura pública tweets" ON political_tweets FOR SELECT USING (TRUE);

-- Limpia tweets viejos (>24h) en cada nuevo insert para mantener fresh el feed
CREATE OR REPLACE FUNCTION cleanup_old_tweets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM political_tweets WHERE fetched_at < NOW() - INTERVAL '24 hours';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cleanup_tweets ON political_tweets;
CREATE TRIGGER trigger_cleanup_tweets
  AFTER INSERT ON political_tweets
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_tweets();
