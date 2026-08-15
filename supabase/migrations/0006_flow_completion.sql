-- SafeYou-Campus: completes the end-to-end safety flow.
--
--   1. sos_events.incident_type — the SOS alert carries an incident type.
--   2. offline_events — offline detection is persisted (not just a status flag).
--   3. heartbeat() RPC — atomic per-minute status/location update + auto-recovery.
--   4. trigger_sos() re-created with p_incident_type.
--   5. incidents delete policy — users can manage (remove) their own reports.

-- 1. Incident type on SOS events -------------------------------------------
alter table public.sos_events
  add column if not exists incident_type text not null default 'emergency';

-- 2. Offline events (recorded when a user goes unexpectedly silent) ---------
create table if not exists public.offline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  last_known_lat float8,
  last_known_lng float8,
  last_active_at timestamptz,
  detected_at timestamptz not null default now(),
  notified_contact_ids uuid[] not null default '{}',
  resolved_at timestamptz
);

alter table public.offline_events enable row level security;

create index if not exists offline_events_user_id_idx on public.offline_events (user_id);
create index if not exists offline_events_detected_at_idx on public.offline_events (detected_at desc);

-- Readable by the affected user and campus security; written only by the
-- offline-detection Edge Function (service_role, which bypasses RLS).
create policy "offline events readable by owner or security"
  on public.offline_events for select
  to authenticated
  using (user_id = auth.uid() or public.is_campus_security());

-- 3. Atomic heartbeat: updates location + last_active_at every minute and
--    auto-recovers 'offline-suspected' → 'safe' when a fresh beat arrives.
create or replace function public.heartbeat(
  p_lat float8 default null,
  p_lng float8 default null,
  p_accuracy float8 default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  update public.users
  set last_known_lat = coalesce(p_lat, last_known_lat),
      last_known_lng = coalesce(p_lng, last_known_lng),
      last_known_accuracy = coalesce(p_accuracy, last_known_accuracy),
      last_active_at = now(),
      -- Recover from offline-suspected, but never clobber an active SOS.
      current_status = case
        when current_status = 'offline-suspected' then 'safe'
        else current_status
      end
  where id = v_uid;
end;
$$;

revoke all on function public.heartbeat from public, anon;
grant execute on function public.heartbeat to authenticated;

-- 4. Re-create trigger_sos with an incident type ----------------------------
create or replace function public.trigger_sos(
  p_lat float8 default null,
  p_lng float8 default null,
  p_source text default 'manual',
  p_incident_type text default 'emergency'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_last timestamptz;
  v_event uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id into v_existing
  from public.sos_events
  where user_id = v_uid and status = 'active'
  order by triggered_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select max(triggered_at) into v_last
  from public.sos_events
  where user_id = v_uid;
  if v_last is not null and (now() - v_last) < interval '30 seconds' then
    raise exception 'You already sent an SOS recently. Please wait before sending another.'
      using errcode = 'P0001';
  end if;

  insert into public.sos_events
    (user_id, triggered_at, lat, lng, status, notified_contact_ids, source, incident_type)
  values
    (v_uid, now(), p_lat, p_lng, 'active', '{}', p_source, p_incident_type)
  returning id into v_event;

  update public.users set current_status = 'sos' where id = v_uid;

  return v_event;
end;
$$;

revoke all on function public.trigger_sos from public, anon;
grant execute on function public.trigger_sos to authenticated;

-- 5. Let reporters delete their own (unresolved) reports --------------------
create policy "incidents deletable by reporter"
  on public.incidents for delete
  to authenticated
  using (reporter_id = auth.uid());
