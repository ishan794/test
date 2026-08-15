-- SafeYou-Campus: security functions.
--
--   * trigger_sos / resolve_sos — atomic SOS lifecycle with a per-user cooldown
--     and dedup, replacing the old two-step client writes (partial failure could
--     leave current_status stale, and SOS could be spammed).
--   * moderate_incident — idempotent (dedup table), content-moderated,
--     geospatial rollup into risk_zones (single DB transaction).
--   * trg_throttle_incidents — per-reporter / anonymous rate limit.

-- ============================================================================
-- SOS lifecycle (M1: atomicity + cooldown)
-- ============================================================================

create or replace function public.trigger_sos(
  p_lat float8 default null,
  p_lng float8 default null,
  p_source text default 'manual'
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

  -- Idempotent: reuse the user's existing active SOS instead of stacking events.
  select id into v_existing
  from public.sos_events
  where user_id = v_uid and status = 'active'
  order by triggered_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Cooldown: at most one SOS per 30 seconds.
  select max(triggered_at) into v_last
  from public.sos_events
  where user_id = v_uid;
  if v_last is not null and (now() - v_last) < interval '30 seconds' then
    raise exception 'You already sent an SOS recently. Please wait before sending another.'
      using errcode = 'P0001';
  end if;

  insert into public.sos_events (user_id, triggered_at, lat, lng, status, notified_contact_ids, source)
  values (v_uid, now(), p_lat, p_lng, 'active', '{}', p_source)
  returning id into v_event;

  -- Same transaction: the status update cannot partially fail.
  update public.users set current_status = 'sos' where id = v_uid;

  return v_event;
end;
$$;

create or replace function public.resolve_sos(p_event_id uuid)
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

  update public.sos_events
  set status = 'resolved', resolved_at = now()
  where id = p_event_id and user_id = v_uid;
  if not found then
    raise exception 'SOS event not found' using errcode = 'P0001';
  end if;

  update public.users set current_status = 'safe' where id = v_uid;
end;
$$;

revoke all on function public.trigger_sos from public, anon;
revoke all on function public.resolve_sos from public, anon;
grant execute on function public.trigger_sos to authenticated;
grant execute on function public.resolve_sos to authenticated;

-- ============================================================================
-- Incident moderation + geospatial rollup (M6)
-- (webhook_events idempotency table is created in 0001_init.sql)
-- ============================================================================
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

  -- Idempotency: process each incident exactly once, even if pg_net retries.
  insert into public.webhook_events (event_id) values (p_incident_id::text)
  on conflict (event_id) do nothing;
  if not found then
    return jsonb_build_object('skipped', 'already processed');
  end if;

  -- Actual moderation: reject empty and clearly-abusive/spam content.
  v_status := 'submitted';
  if v_inc.description is null or length(btrim(v_inc.description)) < 3 then
    v_status := 'rejected';
  elsif v_inc.description ~* '(buy now|viagra|casino|https?://|paypal|crypto|free money)' then
    v_status := 'rejected';
  end if;
  update public.incidents set status = v_status where id = p_incident_id;

  -- Geospatial rollup: find a zone within radius using the earthdistance index,
  -- otherwise create one. Rejected reports do not affect the heatmap.
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
      insert into public.risk_zones (center_lat, center_lng, radius_meters, risk_score, incident_count, updated_at)
      values (v_inc.lat, v_inc.lng, v_zones_radius, 12, 1, now())
      returning id into v_zone_id;
    else
      update public.risk_zones
      set incident_count = incident_count + 1,
          risk_score = least(100, risk_score + 12),
          updated_at = now()
      where id = v_zone_id;
    end if;
  end if;

  return jsonb_build_object('incident_id', p_incident_id, 'status', v_status, 'zone_id', v_zone_id);
end;
$$;

revoke all on function public.moderate_incident from public, anon, authenticated;
grant execute on function public.moderate_incident to service_role;

-- ============================================================================
-- Incident rate limit (C3: no unbounded anonymous / reporter spam)
-- ============================================================================
create or replace function public.throttle_incidents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporter_id is not null then
    if (select count(*) from public.incidents
        where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Too many reports. Please try again later.' using errcode = 'P0001';
    end if;
  else
    if (select count(*) from public.incidents
        where reporter_id is null and created_at > now() - interval '1 minute') >= 10 then
      raise exception 'Too many reports. Please try again later.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_throttle_incidents
  before insert on public.incidents
  for each row execute function public.throttle_incidents();
