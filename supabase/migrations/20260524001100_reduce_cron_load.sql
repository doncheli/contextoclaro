-- ══════════════════════════════════════════════════════════
-- CRON — Reducir carga: site-search cada 60min, revalidate cada 30min
-- ══════════════════════════════════════════════════════════
-- Los crons cada 10-15 min estaban congestionando la DB durante
-- horas pico. Los usuarios reciben "canceling statement due to
-- statement timeout".

-- Site-search: 15min → 60min, limit 15 → 10
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-search-image-every-15min') THEN
    PERFORM cron.unschedule('site-search-image-every-15min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-search-image-hourly') THEN
    PERFORM cron.unschedule('site-search-image-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'site-search-image-hourly',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbtqtzqpoejeojfnajpu.supabase.co/functions/v1/site-search-image?limit=10',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Revalidate: 10min → 30min, limit 30 → 15
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revalidate-news-every-10min') THEN
    PERFORM cron.unschedule('revalidate-news-every-10min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revalidate-news-half-hour') THEN
    PERFORM cron.unschedule('revalidate-news-half-hour');
  END IF;
END $$;

SELECT cron.schedule(
  'revalidate-news-half-hour',
  '23,53 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbtqtzqpoejeojfnajpu.supabase.co/functions/v1/revalidate-news?limit=15',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Aumentar statement_timeout específicamente para la role anon
-- (afecta solo el role de la app, no service_role).
-- Vercel hace requests con auth anon → este es el timeout efectivo.
ALTER ROLE anon SET statement_timeout = '15s';
