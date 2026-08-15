-- SafeYou-Campus: schedules the offline-detection Edge Function every 2 minutes.
-- Replace <PROJECT_REF> with your Supabase project ref and <SUPABASE_ANON_KEY>
-- with your project's anon/public key before running. pg_cron must be enabled
-- for your project (managed Supabase: Database → Extensions → pg_cron).

create extension if not exists pg_cron;

select cron.schedule(
  'safeyou-offline-detection',
  '*/2 * * * *',
  $$
  select pg_net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/offline-detection',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := jsonb_build_object('type', 'cron', 'job', 'offline-detection')
  );
  $$
);

-- To remove the schedule later:
-- select cron.unschedule('safeyou-offline-detection');