-- ══════════════════════════════════════════════════════════
-- COMMENTS — Counters de likes/dislikes + tabla de votos
-- ══════════════════════════════════════════════════════════

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count INT NOT NULL DEFAULT 0;

-- Tabla de votos individuales (1 vote por comment + voter_token)
CREATE TABLE IF NOT EXISTS comment_votes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id   BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_token  TEXT NOT NULL,
  vote         SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, voter_token)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes (comment_id);

ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de votos" ON comment_votes;
CREATE POLICY "Lectura pública de votos"
  ON comment_votes FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Cualquiera puede votar" ON comment_votes;
CREATE POLICY "Cualquiera puede votar"
  ON comment_votes FOR INSERT
  WITH CHECK (vote IN (1, -1) AND char_length(voter_token) BETWEEN 16 AND 128);

DROP POLICY IF EXISTS "Cualquiera puede borrar su voto" ON comment_votes;
CREATE POLICY "Cualquiera puede borrar su voto"
  ON comment_votes FOR DELETE
  USING (TRUE);

-- ══════════════════════════════════════════════════════════
-- TRIGGERS para mantener counters sincronizados
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_comment_vote_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSE
      UPDATE comments SET dislikes_count = dislikes_count + 1 WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
    ELSE
      UPDATE comments SET dislikes_count = GREATEST(0, dislikes_count - 1) WHERE id = OLD.comment_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_comment_vote_counters_ins ON comment_votes;
CREATE TRIGGER trigger_comment_vote_counters_ins
  AFTER INSERT ON comment_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_vote_counters();

DROP TRIGGER IF EXISTS trigger_comment_vote_counters_del ON comment_votes;
CREATE TRIGGER trigger_comment_vote_counters_del
  AFTER DELETE ON comment_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_vote_counters();
