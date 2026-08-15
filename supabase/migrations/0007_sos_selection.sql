-- SafeYou-Campus: SOS selection + lifecycle, contact priority, SMS fallback, and
-- heatmap incident-type aggregation.
--
--   1. sos_events: per-event target contacts, incident type (already added in
--      0006), and an expanded lifecycle: active → acknowledged → resolved /
--      cancelled, with alert-sent + acknowledgement timestamps.
--   2. trusted_contacts: primary/secondary priority.
--   3. users: sms_fallback_enabled (emergency SMS when offline).
--   4. risk_zones: incident_types breakdown for the heatmap.
--   5. trigger_sos: accepts selected contact ids (only those get notified).
--   6. acknowledge_sos / cancel_sos: new lifecycle RPCs.
--   7. moderate_incident: also aggregates incident types per zone.

-- 1a. SOS lifecycle + selection columns --------------------------------------
alter table public.sos_events
  add column if not exists target_contact_ids uuid[] not null default '{}',
  add column if not exists alert_sent_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.users (id) on delete set null;

-- Replace the "one active SOS per user" index to also cover acknowledged
-- (unresolved) events so duplicates can't stack while a contact is en route.
drop index if exists public.sos_events_one_active_per_user_idx;
create unique index if not exists sos_events_one_open_per_user_idx
  on public.sos_events (user_id)
  where status in ('active', 'acknowledged');

-- 1b. Contact priority -------------------------------------------------------
alter table public.trusted_contacts
  add column if not exists priority text not null default 'secondary'
  check (priority in ('primary', 'secondary'));

create index if not exists trusted_contacts_priority_idx
  on public.trusted_contacts (user_id, priority);

-- 1c. Emergency SMS fallback toggle ------------------------------------------
alter table public.users
  add column if not exists sms_fallback_enabled boolean not null default false;

-- 1d. Heatmap incident-type breakdown ----------------------------------------
alter table public.risk_zones
  add column if not exists incident_types jsonb not null default '{}'::jsonb;

-- 2. trigger_sos: accept the specific contacts to notify ---------------------
create or replace function public.trigger_sos(
  p_lat float8 default null,
  p_lng float8 default null,
  p_source text default 'manual',
  p_incident_type text default 'emergency',
  p_contact_ids uuid[] default null
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
  where user_id = v_uid and status in ('active', 'acknowledged')
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
    (user_id, triggered_at, lat, lng, status, notified_contact_ids, source, incident_type, target_contact_ids)
  values
    (v_uid, now(), p_lat, p_lng, 'active', '{}', p_source, p_incident_type, coalesce(p_contact_ids, '{}'))
  returning id into v_event;

  update public.users set current_status = 'sos' where id = v_uid;

  return v_event;
end;
$$;

revoke all on function public.trigger_sos from public, anon;
grant execute on function public.trigger_sos to authenticated;

-- 3. acknowledge_sos: a trusted contact confirms they received the alert ------
create or replace function public.acknowledge_sos(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_is_contact boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select user_id into v_owner from public.sos_events where id = p_event_id;
  if v_owner is null then
    raise exception 'SOS event not found' using errcode = 'P0001';
  end if;

  -- Owner, campus security, or a user listed as a linked trusted contact of
  -- the SOS owner may acknowledge.
  select exists (
    select 1 from public.trusted_contacts tc
    where tc.user_id = v_owner and tc.linked_uid = v_uid
  ) into v_is_contact;

  if v_uid <> v_owner and not v_is_contact and not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.sos_events
  set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = v_uid
  where id = p_event_id and status = 'active';
end;
$$;

revoke all on function public.acknowledge_sos from public, anon;
grant execute on function public.acknowledge_sos to authenticated;

-- 4. cancel_sos: owner cancels an accidental SOS before escalation ------------
create or replace function public.cancel_sos(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select user_id into v_owner from public.sos_events where id = p_event_id;
  if v_owner is null then
    raise exception 'SOS event not found' using errcode = 'P0001';
  end if;

  if v_uid <> v_owner and not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.sos_events
  set status = 'cancelled', resolved_at = now()
  where id = p_event_id and status in ('active', 'acknowledged');

  update public.users set current_status = 'safe' where id = v_owner;
end;
$$;

revoke all on function public.cancel_sos from public, anon;
grant execute on function public.cancel_sos to authenticated;

-- 5. moderate_incident: also aggregate incident types per zone ----------------
create or replace function public.moderate_incident(p_incident_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inc public.incidents%rowtype;
  v_zone_id uuid;
  v_status text;
  v_zones_radius int := 150;
begin
  select * into v_inc from public.incidents where id = p_incident_id;
  if not found then
    return jsonb_build_object('error', 'incident not found');
  end if;

  insert into public.webhook_events (event_id) values (p_incident_id::text)
  on conflict (event_id) do nothing;
  if not found then
    return jsonb_build_object('skipped', 'already processed');
  end if;

  v_status := 'submitted';
  if v_inc.description is null or length(btrim(v_inc.description)) < 3 then
    v_status := 'rejected';
  elsif v_inc.description ~* '(buy now|viagra|casino|https?://|paypal|crypto|free money)' then
    v_status := 'rejected';
  end if;
  update public.incidents set status = v_status where id = p_incident_id;

  if v_status <> 'rejected' and v_inc.lat is not null and v_inc.lng is not null then
    select z.id into v_zone_id
    from public.risk_zones z
    where earth_distance(
            ll_to_earth(z.center_lat, z.center_lng),
            ll_to_earth(v_inc.lat, v_inc.lng)
          ) < z.radius_meters
    order by earth_distance(
            ll_to_earth(z.center_lat, z.center_lng),
            ll_to_earth(v_inc.lat, v_inc.lng)
          )
    limit 1;

    if v_zone_id is null then
      insert into public.risk_zones (center_lat, center_lng, radius_meters, risk_score, incident_count, updated_at, incident_types)
      values (
        v_inc.lat, v_inc.lng, v_zones_radius, 12, 1, now(),
        case when v_inc.type is not null then jsonb_build_object(v_inc.type, 1) else '{}'::jsonb end
      )
      returning id into v_zone_id;
    else
      update public.risk_zones
      set incident_count = incident_count + 1,
          risk_score = least(100, risk_score + 12),
          updated_at = now(),
          incident_types = case
            when v_inc.type is not null then
              incident_types || jsonb_build_object(
                v_inc.type,
                coalesce((incident_types ->> v_inc.type)::int, 0) + 1
              )
            else incident_types
          end
      where id = v_zone_id;
    end if;
  end if;

  return jsonb_build_object('incident_id', p_incident_id, 'status', v_status, 'zone_id', v_zone_id);
end;
$$;

revoke all on function public.moderate_incident from public, anon, authenticated;
grant execute on function public.moderate_incident to service_role;
