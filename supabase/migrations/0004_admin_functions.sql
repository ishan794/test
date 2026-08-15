-- SafeYou-Campus: campus-security admin functions.
-- These are security-definer functions that gate on the campus_security role so
-- the (non-existent) admin portal has a real, permission-checked data layer.

-- Combined live alert feed: active SOS events + offline-suspected users, with
-- location and a contact phone for dispatch. Returns rows with a `kind` tag.
create or replace function public.get_active_alerts()
returns table (
  id uuid,
  kind text,
  user_id uuid,
  full_name text,
  phone text,
  lat float8,
  lng float8,
  occurred_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
  select e.id, 'sos'::text, e.user_id, u.full_name, u.phone,
         e.lat, e.lng, e.triggered_at, e.status
  from public.sos_events e
  join public.users u on u.id = e.user_id
  where e.status = 'active'

  union all

  select u.id, 'offline'::text, u.id, u.full_name, u.phone,
         u.last_known_lat, u.last_known_lng, u.last_active_at, u.current_status
  from public.users u
  where u.current_status = 'offline-suspected';
end;
$$;

-- Resolve any active SOS on behalf of a student (dispatch confirmed safety).
create or replace function public.admin_resolve_sos(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select user_id into v_uid from public.sos_events where id = p_event_id;
  if v_uid is null then
    raise exception 'SOS event not found' using errcode = 'P0001';
  end if;

  update public.sos_events set status = 'resolved', resolved_at = now()
  where id = p_event_id and status = 'active';
  update public.users set current_status = 'safe' where id = v_uid;
end;
$$;

-- Advance an incident through review states ('submitted' → 'under-review' → 'resolved').
create or replace function public.admin_set_incident_status(p_incident_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'under-review', 'resolved', 'rejected') then
    raise exception 'Invalid status' using errcode = 'P0001';
  end if;

  update public.incidents set status = p_status where id = p_incident_id;
  if not found then
    raise exception 'Incident not found' using errcode = 'P0001';
  end if;
end;
$$;

-- Admin feed of recent incidents (newest first). Campus security can already
-- read incidents via RLS; this just returns a bounded, ordered page.
create or replace function public.list_incidents(p_limit int default 100)
returns table (
  id uuid,
  type text,
  description text,
  lat float8,
  lng float8,
  status text,
  is_anonymous boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campus_security() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
  select i.id, i.type, i.description, i.lat, i.lng, i.status, i.is_anonymous, i.created_at
  from public.incidents i
  order by i.created_at desc
  limit greatest(least(coalesce(p_limit, 100), 500), 1);
end;
$$;

revoke all on function public.get_active_alerts from public, anon;
revoke all on function public.admin_resolve_sos from public, anon;
revoke all on function public.admin_set_incident_status from public, anon;
revoke all on function public.list_incidents from public, anon;
grant execute on function public.get_active_alerts to authenticated;
grant execute on function public.admin_resolve_sos to authenticated;
grant execute on function public.admin_set_incident_status to authenticated;
grant execute on function public.list_incidents to authenticated;
