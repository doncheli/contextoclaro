-- ══════════════════════════════════════════════════════════
-- COMMENTS — Anti-spam y bloqueo de URLs en el contenido
-- ══════════════════════════════════════════════════════════

-- Bloquea URLs y dominios comunes en cualquier comentario
ALTER TABLE comments
  ADD CONSTRAINT comments_no_urls
  CHECK (
    content !~* '(https?://|www\.[a-z0-9])'
    AND content !~* '(\.com\b|\.net\b|\.org\b|\.io\b|\.co\b|\.ru\b|\.cn\b|\.xyz\b|\.online\b|\.club\b|\.shop\b|\.site\b|\.bet\b|\.casino\b|t\.me/|bit\.ly/|tinyurl\.com|wa\.me/|whatsapp\.com/send)'
  );

-- Bloquea keywords de spam comunes
ALTER TABLE comments
  ADD CONSTRAINT comments_no_spam_keywords
  CHECK (
    content !~* '\m(viagra|cialis|levitra|kamagra|casino|poker online|porn|sex chat|escort|click here to buy|crypto giveaway|bitcoin double|free airdrop|telegram group|whatsapp gana|join my channel|earn \$\d|make money fast|forex signals|trading bot|inverte y gana|mi numero whatsapp|seo agency|backlinks cheap|buy followers)\M'
  );

-- Bloquea exceso de caracteres repetidos (e.g. "aaaaaaa" o "!!!!!!!!!!")
ALTER TABLE comments
  ADD CONSTRAINT comments_no_excessive_repetition
  CHECK (content !~ '(.)\1{9,}');

-- Bloquea autores con caracteres extraños (sólo letras/números/espacios/acentos)
ALTER TABLE comments
  ADD CONSTRAINT comments_clean_author
  CHECK (author_name ~ '^[\sA-Za-zÁÉÍÓÚáéíóúÑñÜüÇç''.-]+$');

-- ══════════════════════════════════════════════════════════
-- RATE LIMITING: máximo 1 comentario cada 30s por news_id+author
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION enforce_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM comments
  WHERE news_id = NEW.news_id
    AND lower(author_name) = lower(NEW.author_name)
    AND created_at > NOW() - INTERVAL '30 seconds';

  IF recent_count > 0 THEN
    RAISE EXCEPTION 'Espera unos segundos antes de comentar de nuevo.' USING ERRCODE = '42501';
  END IF;

  -- Detectar duplicados exactos en los últimos 5 minutos (mismo contenido)
  SELECT COUNT(*) INTO recent_count
  FROM comments
  WHERE news_id = NEW.news_id
    AND content = NEW.content
    AND created_at > NOW() - INTERVAL '5 minutes';

  IF recent_count > 0 THEN
    RAISE EXCEPTION 'Este comentario ya fue publicado.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_comments_rate_limit ON comments;
CREATE TRIGGER trigger_comments_rate_limit
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_comment_rate_limit();
