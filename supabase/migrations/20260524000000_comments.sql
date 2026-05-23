-- ══════════════════════════════════════════════════════════
-- COMMENTS — Sistema de comentarios propio para Contexto Claro
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comments (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  news_id      BIGINT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  parent_id    BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 50),
  author_email TEXT,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 2000),
  approved     BOOLEAN NOT NULL DEFAULT TRUE,
  flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash      TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_news_id  ON comments (news_id);
CREATE INDEX IF NOT EXISTS idx_comments_created  ON comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent   ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments (approved) WHERE approved = TRUE;

-- ══════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de comentarios aprobados" ON comments;
CREATE POLICY "Lectura pública de comentarios aprobados"
  ON comments FOR SELECT
  USING (approved = TRUE);

DROP POLICY IF EXISTS "Cualquiera puede insertar comentarios" ON comments;
CREATE POLICY "Cualquiera puede insertar comentarios"
  ON comments FOR INSERT
  WITH CHECK (
    char_length(author_name) BETWEEN 2 AND 50
    AND char_length(content) BETWEEN 5 AND 2000
    AND (approved = TRUE)
    AND (flagged = FALSE)
  );

-- ══════════════════════════════════════════════════════════
-- HELPERS PARA EL FRONTEND
-- ══════════════════════════════════════════════════════════

-- Conteo de comentarios aprobados por noticia (uso en cards).
CREATE OR REPLACE FUNCTION comments_count(p_news_id BIGINT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM comments WHERE news_id = p_news_id AND approved = TRUE;
$$;
