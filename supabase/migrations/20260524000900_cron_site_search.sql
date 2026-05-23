-- ══════════════════════════════════════════════════════════
-- CRON — Site search image recovery cada 15 min
-- ══════════════════════════════════════════════════════════
-- Procesa 15 noticias sin imagen por corrida → recupera la
-- imagen original buscando el artículo en el sitio fuente
-- por título (La Patilla, Runrunes, El Nacional, etc.).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-search-image-every-15min') THEN
    PERFORM cron.unschedule('site-search-image-every-15min');
  END IF;
END $$;

SELECT cron.schedule(
  'site-search-image-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbtqtzqpoejeojfnajpu.supabase.co/functions/v1/site-search-image?limit=15',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw"}'::jsonb,
    timeout_milliseconds := 180000
  );
  $$
);
