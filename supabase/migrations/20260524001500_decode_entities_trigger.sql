-- ══════════════════════════════════════════════════════════
-- Trigger preventivo — decodifica entities HTML al insertar/actualizar
-- ══════════════════════════════════════════════════════════
-- Cubre las entities más comunes vistas en RSS de Runrun.es, La Patilla,
-- WordPress feeds y similares. Numéricas decimales se procesan con loop.

CREATE OR REPLACE FUNCTION decode_html_entities(s TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  out TEXT;
  m TEXT;
  iters INT := 0;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  out := s;

  -- Entities numéricas decimales &#NNNN; (loop con safety break)
  WHILE out ~ '&#\d{2,5};' AND iters < 1000 LOOP
    m := substring(out FROM '&#(\d{2,5});');
    EXIT WHEN m IS NULL;
    out := replace(out, '&#' || m || ';', chr(m::int));
    iters := iters + 1;
  END LOOP;

  -- Entities nombradas comunes
  out := replace(out, '&nbsp;', ' ');
  out := replace(out, '&amp;', '&');
  out := replace(out, '&lt;', '<');
  out := replace(out, '&gt;', '>');
  out := replace(out, '&quot;', '"');
  out := replace(out, '&apos;', '''');
  out := replace(out, '&mdash;', '—');
  out := replace(out, '&ndash;', '–');
  out := replace(out, '&hellip;', '…');
  out := replace(out, '&laquo;', '«');
  out := replace(out, '&raquo;', '»');
  out := replace(out, '&ldquo;', '"');
  out := replace(out, '&rdquo;', '"');
  out := replace(out, '&lsquo;', '''');
  out := replace(out, '&rsquo;', '''');
  out := replace(out, '&iquest;', '¿');
  out := replace(out, '&iexcl;', '¡');
  out := replace(out, '&ntilde;', 'ñ');
  out := replace(out, '&Ntilde;', 'Ñ');
  out := replace(out, '&aacute;', 'á');
  out := replace(out, '&eacute;', 'é');
  out := replace(out, '&iacute;', 'í');
  out := replace(out, '&oacute;', 'ó');
  out := replace(out, '&uacute;', 'ú');
  out := replace(out, '&Aacute;', 'Á');
  out := replace(out, '&Eacute;', 'É');
  out := replace(out, '&Iacute;', 'Í');
  out := replace(out, '&Oacute;', 'Ó');
  out := replace(out, '&Uacute;', 'Ú');
  out := replace(out, '&uuml;', 'ü');
  out := replace(out, '&Uuml;', 'Ü');
  out := replace(out, '&euro;', '€');
  out := replace(out, '&copy;', '©');
  out := replace(out, '&reg;', '®');
  out := replace(out, '&middot;', '·');
  out := replace(out, '&bull;', '•');
  out := replace(out, '&times;', '×');
  out := replace(out, '&deg;', '°');
  out := replace(out, '&sect;', '§');

  RETURN out;
END;
$$;

-- Trigger en news
CREATE OR REPLACE FUNCTION news_decode_entities_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN NEW.title := decode_html_entities(NEW.title); END IF;
  IF NEW.description IS NOT NULL THEN NEW.description := decode_html_entities(NEW.description); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_decode_entities ON news;
CREATE TRIGGER trg_news_decode_entities
  BEFORE INSERT OR UPDATE OF title, description ON news
  FOR EACH ROW EXECUTE FUNCTION news_decode_entities_trigger();

-- Trigger en article_paragraphs
CREATE OR REPLACE FUNCTION paragraph_decode_entities_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content IS NOT NULL THEN NEW.content := decode_html_entities(NEW.content); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paragraphs_decode_entities ON article_paragraphs;
CREATE TRIGGER trg_paragraphs_decode_entities
  BEFORE INSERT OR UPDATE OF content ON article_paragraphs
  FOR EACH ROW EXECUTE FUNCTION paragraph_decode_entities_trigger();
