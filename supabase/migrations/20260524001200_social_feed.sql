-- ══════════════════════════════════════════════════════════
-- SOCIAL FEED — Extender political_tweets para múltiples sources
-- ══════════════════════════════════════════════════════════
-- X / Twitter API free tier no permite búsqueda (CreditsDepleted).
-- Pivotamos a Mastodon y Google News RSS — gratis, confiable y
-- con contenido relevante de política VE/CO.

ALTER TABLE political_tweets
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'twitter',
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Permitir 'mastodon' y 'gnews' en country_code de fuentes mixtas:
-- (no necesitamos cambiar el check porque VE/CO siguen siendo válidos)

-- Índice para query rápida por país + fecha
CREATE INDEX IF NOT EXISTS idx_political_tweets_country_fetched
  ON political_tweets (country_code, fetched_at DESC);

-- Permitir múltiples sources sin colisión por tweet_id
-- (un mismo ID en diferentes sources es ok)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'political_tweets_tweet_id_country_code_key'
  ) THEN
    ALTER TABLE political_tweets DROP CONSTRAINT political_tweets_tweet_id_country_code_key;
  END IF;
END $$;

ALTER TABLE political_tweets
  ADD CONSTRAINT political_tweets_id_source_unique UNIQUE (tweet_id, source, country_code);
