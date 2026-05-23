-- ══════════════════════════════════════════════════════════
-- ARTICLE PARAGRAPHS — Soporte para imágenes y videos embed
-- ══════════════════════════════════════════════════════════
-- Permite intercalar evidencia gráfica (fotos de implicados,
-- videos YouTube, gráficos) dentro del cuerpo de un artículo.

ALTER TABLE article_paragraphs
  ADD COLUMN IF NOT EXISTS media_type    TEXT,
  ADD COLUMN IF NOT EXISTS media_url     TEXT,
  ADD COLUMN IF NOT EXISTS media_caption TEXT,
  ADD COLUMN IF NOT EXISTS media_alt     TEXT;

ALTER TABLE article_paragraphs
  ADD CONSTRAINT chk_media_type
  CHECK (media_type IS NULL OR media_type IN ('image', 'youtube', 'video', 'gallery'));

-- El contenido pasa a ser opcional cuando hay media (un párrafo puede
-- ser solo una imagen con caption sin texto principal).
ALTER TABLE article_paragraphs
  ALTER COLUMN content DROP NOT NULL;
