-- ══════════════════════════════════════════════════════════
-- CRON — Re-validar noticias unverified cada 10 minutos
-- ══════════════════════════════════════════════════════════
-- Llama a la edge function revalidate-news automáticamente para
-- procesar la cola de noticias con gemini_validated=false |
-- gemini_verdict=unverified | gemini_verdict IS NULL.

-- pg_cron y pg_net deben estar habilitados desde el dashboard de
-- Supabase: Database → Extensions → buscar "pg_cron" y "pg_net" → Enable.
-- Si fallan al ejecutar este archivo, hazlo manualmente primero.

-- Quitar job anterior si existía (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revalidate-news-every-10min') THEN
    PERFORM cron.unschedule('revalidate-news-every-10min');
  END IF;
END $$;

-- Crear job que invoca la edge function cada 10 minutos
-- La function fue deployada con --no-verify-jwt, así que el cron
-- puede invocarla con el anon key (public). El service_role lo
-- obtiene desde Deno.env dentro del propio edge function.
SELECT cron.schedule(
  'revalidate-news-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbtqtzqpoejeojfnajpu.supabase.co/functions/v1/revalidate-news?limit=30',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
