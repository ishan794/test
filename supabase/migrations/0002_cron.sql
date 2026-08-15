-- SafeYou-Campus: schedules the offline-detection Edge Function every 2 minutes.
-- pg_cron must be enabled for your project (Database → Extensions → pg_cron).
-- The call authenticates with the same shared webhook secret stored in Vault
-- (see 0001_init.sql), so no key is committed here.

create extension if not exists pg_cron;

select cron.schedule(
  'safeyou-offline-detection',
  '*/2 * * * *',
  $$
  select pg_net.http_post(
    url := public.fn_base_url() || '/functions/v1/offline-detection',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.fn_webhook_secret()
    ),
    body := jsonb_build_object('type', 'cron', 'job', 'offline-detection')
  );
  $$
);

-- To remove the schedule later:
-- select cron.unschedule('safeyou-offline-detection');
