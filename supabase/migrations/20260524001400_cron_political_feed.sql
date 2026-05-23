-- ══════════════════════════════════════════════════════════
-- CRON — Refresh feed político (Mastodon + Google News RSS) cada 30min
-- ══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-political-feed-30min') THEN
    PERFORM cron.unschedule('refresh-political-feed-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-political-feed-30min',
  '7,37 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbtqtzqpoejeojfnajpu.supabase.co/functions/v1/refresh-political-feed',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHF0enFwb2VqZW9qZm5hanB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjExNTUsImV4cCI6MjA4ODkzNzE1NX0.VBCGM9Ov3rLUyAFlDpzRRj4t9MWMTlXuilGuN6LLjDw"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
