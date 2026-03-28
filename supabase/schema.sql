-- ══════════════════════════════════════════════════════════
-- LATAM INSIGHT — Schema para Supabase (PostgreSQL)
-- Ejecutar en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════

-- 1. Tabla principal de noticias
CREATE TABLE news (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  news_type     TEXT NOT NULL CHECK (news_type IN ('hero', 'daily', 'blindspot', 'feed')),
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  country       TEXT NOT NULL,          -- emoji flag: 🇨🇴, 🇻🇪, etc.
  image         TEXT,                   -- URL de imagen
  read_time     TEXT,                   -- "8 min de lectura"
  author        TEXT,
  bias_left     SMALLINT NOT NULL DEFAULT 0,
  bias_center   SMALLINT NOT NULL DEFAULT 0,
  bias_right    SMALLINT NOT NULL DEFAULT 0,
  bias_label    TEXT,                   -- EQUILIBRADO, IZQUIERDA, CENTRO, DERECHA
  credibility   TEXT CHECK (credibility IN ('alta', 'media', 'baja')),
  source_count  INT DEFAULT 0,
  veracity      TEXT NOT NULL DEFAULT 'verificada' CHECK (veracity IN ('verificada', 'parcialmente_falsa', 'fake')),
  veracity_detail TEXT,
  sponsored_flag TEXT,                  -- NULL = no patrocinada
  -- Campos específicos de blindspot
  blindspot_side     TEXT,              -- "IZQUIERDA IGNORA", "DERECHA IGNORA"
  blindspot_icon     TEXT,              -- "left", "right"
  blindspot_severity TEXT,
  blindspot_sources_missing INT,
  blindspot_detail   TEXT,
  -- Campos de feed
  source_label  TEXT,                   -- "El Universo / Prensa Latina"
  time_label    TEXT,                   -- "Hace 3h"
  -- Scores de fiabilidad
  score_factual      SMALLINT,
  score_source_div   SMALLINT,
  score_transparency SMALLINT,
  score_independence SMALLINT,
  -- Gemini AI validation
  gemini_validated    BOOLEAN DEFAULT false,
  gemini_verdict      TEXT CHECK (gemini_verdict IN ('real', 'misleading', 'fake', 'unverified')),
  gemini_confidence   SMALLINT,
  gemini_reasoning    TEXT,
  gemini_validated_at TIMESTAMPTZ,
  -- Country code for filtering
  country_code  TEXT,
  -- Timestamps
  published_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fuentes por noticia (para el detalle/modal)
CREATE TABLE news_sources (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  news_id      BIGINT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  bias         TEXT NOT NULL,           -- izquierda, centro-izquierda, centro, etc.
  credibility  SMALLINT,               -- 0-100
  stance       TEXT,                    -- descripción de la postura
  sort_order   SMALLINT DEFAULT 0
);

-- 3. Párrafos del artículo (body del modal)
CREATE TABLE article_paragraphs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  news_id      BIGINT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  sort_order   SMALLINT NOT NULL DEFAULT 0
);

-- ══════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════

-- Índice full-text search en español
ALTER TABLE news ADD COLUMN fts TSVECTOR
  GENERATED ALWAYS AS (
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(description, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(category, '')), 'C')
  ) STORED;

CREATE INDEX idx_news_fts ON news USING GIN (fts);

-- Índices para filtrado rápido
CREATE INDEX idx_news_type ON news (news_type);
CREATE INDEX idx_news_country ON news (country);
CREATE INDEX idx_news_category ON news (category);
CREATE INDEX idx_news_veracity ON news (veracity);
CREATE INDEX idx_news_published ON news (published_at DESC);
CREATE INDEX idx_news_gemini ON news (gemini_validated);
CREATE INDEX idx_news_country_code ON news (country_code);

-- Índices para foreign keys
CREATE INDEX idx_sources_news_id ON news_sources (news_id);
CREATE INDEX idx_paragraphs_news_id ON article_paragraphs (news_id);

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════

-- Habilitar RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_paragraphs ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (cualquiera puede leer)
CREATE POLICY "Lectura pública de noticias"
  ON news FOR SELECT
  USING (true);

CREATE POLICY "Lectura pública de fuentes"
  ON news_sources FOR SELECT
  USING (true);

CREATE POLICY "Lectura pública de párrafos"
  ON article_paragraphs FOR SELECT
  USING (true);

-- ══════════════════════════════════════════════════════════
-- FUNCIÓN DE BÚSQUEDA FULL-TEXT
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_news(search_query TEXT, max_results INT DEFAULT 20)
RETURNS SETOF news
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM news
  WHERE fts @@ PLAINTO_TSQUERY('spanish', search_query)
  ORDER BY TS_RANK(fts, PLAINTO_TSQUERY('spanish', search_query)) DESC
  LIMIT max_results;
$$;

-- ══════════════════════════════════════════════════════════
-- FUNCIÓN updated_at automático
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_news_updated_at
  BEFORE UPDATE ON news
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
