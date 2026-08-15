-- SafeYou-Campus: Supabase schema.
--
-- Security model (this replaces the previous "readable by any authenticated
-- user" blanket policies):
--   * A user can read only their OWN row from public.users. Every cross-user
--     read goes through public.safe_users (id, full_name, current_status only)
--     and is restricted to the user's mutual trusted-contact graph.
--   * push_token, phone, email, student_id, university and live location are
--     never exposed across users; push_token is only reachable by service_role
--     (Edge Functions). Anonymous/authenticated clients cannot use pg_net.
--   * Incidents are insertable only by the reporter (or truly anonymous with a
--     server-side rate limit); journey_pings only by the journey owner.
--   * SOS is created/resolved through the trigger_sos / resolve_sos RPCs
--     (atomic + cooldown) defined in 0003_security_functions.sql.

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists cube;
create extension if not exists earthdistance;

-- ============================================================================
-- TABLES
-- ============================================================================

-- USERS (private core profile — read only by the owner and service_role)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  student_id text,
  university text,
  email text,
  phone text,
  verified boolean not null default false,
  role text not null default 'student'
    check (role in ('student', 'campus_security')),
  current_status text not null default 'safe'
    check (current_status in ('safe', 'sos', 'offline-suspected')),
  last_active_at timestamptz,
  last_known_lat float8,
  last_known_lng float8,
  last_known_accuracy float8,
  silent_alert_mode boolean not null default false,
  auto_sos_on_fall boolean not null default true,
  location_sharing_mode text not null default 'always',
  notification_prefs jsonb not null default '{}'::jsonb,
  has_onboarded boolean not null default false,
  push_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text,
  phone text,
  relationship text,
  auto_share boolean not null default true,
  status text not null default 'pending',
  is_system_contact boolean not null default false,
  linked_uid uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now()
);

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'active',
  destination_name text,
  destination_lat float8,
  destination_lng float8,
  start_lat float8,
  start_lng float8,
  started_at timestamptz not null default now(),
  eta_minutes int,
  auto_sos_at timestamptz,
  shared_with_contact_ids uuid[] not null default '{}',
  last_ping_lat float8,
  last_ping_lng float8,
  last_ping_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.journey_pings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  lat float8,
  lng float8,
  speed float8,
  created_at timestamptz not null default now()
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  triggered_at timestamptz not null default now(),
  lat float8,
  lng float8,
  status text not null default 'active',
  notified_contact_ids uuid[] not null default '{}',
  source text not null default 'manual',
  resolved_at timestamptz
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users (id) on delete set null,
  is_anonymous boolean not null default false,
  type text,
  description text,
  lat float8,
  lng float8,
  media_urls text[] not null default '{}',
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

create table if not exists public.risk_zones (
  id uuid primary key default gen_random_uuid(),
  center_lat float8,
  center_lng float8,
  radius_meters int,
  risk_score int not null default 0,
  incident_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Webhook idempotency (M6): pg_net retries must not double-count.
create table if not exists public.webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists users_last_active_at_idx on public.users (last_active_at);
create index if not exists users_role_idx on public.users (role);
create index if not exists trusted_contacts_user_id_idx on public.trusted_contacts (user_id);
create index if not exists trusted_contacts_linked_uid_idx on public.trusted_contacts (linked_uid);
create index if not exists journeys_user_id_idx on public.journeys (user_id);
create index if not exists journeys_status_idx on public.journeys (status);
create index if not exists journey_pings_journey_id_idx on public.journey_pings (journey_id);
create index if not exists sos_events_user_id_idx on public.sos_events (user_id);
create index if not exists incidents_reporter_id_idx on public.incidents (reporter_id);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);
create index if not exists risk_zones_geo_idx
  on public.risk_zones using gist (ll_to_earth(center_lat, center_lng));

-- Dedupe active SOS per user (also used by auto-SOS to avoid stacking).
create unique index if not exists sos_events_one_active_per_user_idx
  on public.sos_events (user_id)
  where status = 'active';

-- ============================================================================
-- TRUSTED GRAPH HELPERS (security definer → no RLS recursion)
-- ============================================================================

-- True when the current caller holds the campus_security role.
create or replace function public.is_campus_security()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'campus_security'
  );
$$;

-- True when a and b are connected by a trusted_contacts.linked_uid edge in
-- either direction (mutual consent — adding someone as a linked contact is a
-- consent action by the adder).
create or replace function public.are_trusted(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trusted_contacts tc
    where (tc.user_id = a and tc.linked_uid = b)
       or (tc.user_id = b and tc.linked_uid = a)
  );
$$;

-- True when the current caller may view this journey: the owner, a trusted
-- contact the journey was explicitly shared with, or campus security.
create or replace function public.can_view_journey(j uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select user_id from public.journeys where id = j) = auth.uid()
    or exists (
      select 1
      from public.journeys jj
      join public.trusted_contacts tc on tc.id = any(jj.shared_with_contact_ids)
      where jj.id = j and tc.linked_uid = auth.uid()
    )
    or public.is_campus_security();
$$;

-- True when the current caller owns this journey (used for ping inserts).
create or replace function public.owns_journey(j uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journeys where id = j and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- SAFE USERS VIEW — the ONLY cross-user projection the client may read.
-- Exposes id/full_name/current_status to self + trusted graph + campus security.
-- No phone, no email, no push_token, no live location.
-- ============================================================================
create or replace view public.safe_users as
select u.id, u.full_name, u.current_status
from public.users u
where u.id = auth.uid()
   or public.are_trusted(auth.uid(), u.id)
   or public.is_campus_security();

revoke all on public.safe_users from anon;
grant select on public.safe_users to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_pings enable row level security;
alter table public.sos_events enable row level security;
alter table public.incidents enable row level security;
alter table public.risk_zones enable row level security;
alter table public.webhook_events enable row level security;

-- users: owner-only reads (service_role bypasses RLS and reads push_token).
create policy "users readable by self"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

create policy "users insertable by self"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users updatable by owner"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- trusted_contacts: owner reads their list; a linked user may read rows that
-- list THEM as linked_uid (to find journeys shared with them); campus security.
create policy "trusted contacts readable by owner, linked, or security"
  on public.trusted_contacts for select
  to authenticated
  using (
    user_id = auth.uid()
    or linked_uid = auth.uid()
    or public.is_campus_security()
  );

create policy "trusted contacts writable by owner"
  on public.trusted_contacts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- journeys: owner, explicitly-shared trusted contacts, or campus security.
create policy "journeys readable by owner, shared contacts, or security"
  on public.journeys for select
  to authenticated
  using (public.can_view_journey(id));

create policy "journeys insertable by owner"
  on public.journeys for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "journeys updatable by owner"
  on public.journeys for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- journey_pings: viewers read, but only the owner writes (no arbitrary injection).
create policy "journey pings readable by journey viewers"
  on public.journey_pings for select
  to authenticated
  using (public.can_view_journey(journey_id));

create policy "journey pings insertable by journey owner"
  on public.journey_pings for insert
  to authenticated
  with check (public.owns_journey(journey_id));

-- sos_events: owner or campus security read. NO client insert/update policies —
-- SOS must go through trigger_sos/resolve_sos (atomic + cooldown).
create policy "sos events readable by owner or security"
  on public.sos_events for select
  to authenticated
  using (user_id = auth.uid() or public.is_campus_security());

-- incidents: authenticated reports must carry the caller as reporter; anonymous
-- reports must have no reporter. Both are rate-limited by trg_throttle_incidents.
create policy "incidents insertable by reporter"
  on public.incidents for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "incidents insertable anonymously"
  on public.incidents for insert
  to anon
  with check (reporter_id is null);

create policy "incidents readable by reporter or security"
  on public.incidents for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_campus_security());

-- risk_zones: public aggregate (no phone/pin-level data).
create policy "risk zones publicly readable"
  on public.risk_zones for select
  to anon, authenticated
  using (true);

-- webhook_events is internal: no client access.
revoke all on public.webhook_events from anon, authenticated;

-- ============================================================================
-- STORAGE BUCKETS + POLICIES
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('incident-evidence', 'incident-evidence', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

create policy "incident evidence readable by authenticated users"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'incident-evidence');

create policy "incident evidence writable by authenticated users"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'incident-evidence');

create policy "profile photos readable by authenticated users"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos');

create policy "profile photos writable by owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- WEBHOOKS → EDGE FUNCTIONS
--
-- The Edge Functions are server-to-server only: they verify a shared secret
-- held in Vault (name: safeyou-webhook-secret) which the operator must also set
-- on each function as WEBHOOK_SECRET via `supabase secrets set`. The functions
-- base URL is read from the Vault secret safeyou-functions-url. Nothing here is
-- committed as a plaintext key, and anon/authenticated cannot invoke pg_net.
-- ============================================================================
revoke usage on schema pg_net from anon, authenticated;
grant usage on schema pg_net to service_role;

create or replace function public.fn_base_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'safeyou-functions-url'),
    ''
  );
$$;

create or replace function public.fn_webhook_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'safeyou-webhook-secret'),
    ''
  );
$$;

create or replace function public.webhook_sos_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text := public.fn_webhook_secret();
begin
  if v_secret = '' then
    raise warning 'safeyou-webhook-secret not configured; skipping sos-fanout';
    return new;
  end if;
  perform pg_net.http_post(
    url := public.fn_base_url() || '/functions/v1/sos-fanout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'type', 'postgres',
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );
  return new;
end;
$$;

create trigger trg_sos_fanout
  after insert on public.sos_events
  for each row execute function public.webhook_sos_fanout();

create or replace function public.webhook_incident_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text := public.fn_webhook_secret();
begin
  if v_secret = '' then
    raise warning 'safeyou-webhook-secret not configured; skipping incident-moderation';
    return new;
  end if;
  perform pg_net.http_post(
    url := public.fn_base_url() || '/functions/v1/incident-moderation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'type', 'postgres',
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );
  return new;
end;
$$;

create trigger trg_incident_moderation
  after insert on public.incidents
  for each row execute function public.webhook_incident_moderation();
