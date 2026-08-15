-- SafeYou-Campus: Supabase schema (replaces Firestore collections 1:1 in meaning)
-- Replace <PROJECT_REF> with your Supabase project ref (e.g. abcdefghijklmnpq)
-- and <SUPABASE_ANON_KEY> with your project's anon/public key before running.

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ============================================================================
-- USERS (was collections/users/{uid})
-- ============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  student_id text,
  university text,
  email text,
  phone text,
  verified boolean not null default false,
  current_status text not null default 'safe'
    check (current_status in ('safe', 'sos', 'offline-suspected')),
  last_active_at timestamptz,
  last_known_lat float8,
  last_known_lng float8,
  last_known_accuracy float8,
  silent_alert_mode boolean not null default false,
  auto_sos_on_fall boolean not null default true,
  location_sharing_mode text not null default 'always',
  has_onboarded boolean not null default false,
  push_token text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create index if not exists users_last_active_at_idx on public.users (last_active_at);

create policy "users readable by any authenticated user"
  on public.users for select
  to authenticated
  using (true);

create policy "users insertable by self"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users updatable by owner"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================================
-- TRUSTED CONTACTS (was collections/users/{uid}/trustedContacts/{contactId})
-- ============================================================================
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

alter table public.trusted_contacts enable row level security;

create index if not exists trusted_contacts_user_id_idx on public.trusted_contacts (user_id);

create policy "trusted contacts readable by any authenticated user"
  on public.trusted_contacts for select
  to authenticated
  using (true);

create policy "trusted contacts writable by owner"
  on public.trusted_contacts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- JOURNEYS (was collections/journeys/{journeyId})
-- ============================================================================
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

alter table public.journeys enable row level security;

create index if not exists journeys_user_id_idx on public.journeys (user_id);
create index if not exists journeys_status_idx on public.journeys (status);

create policy "journeys readable by any authenticated user"
  on public.journeys for select
  to authenticated
  using (true);

create policy "journeys insertable by owner"
  on public.journeys for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "journeys updatable by owner"
  on public.journeys for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- JOURNEY PINGS (was collections/journeys/{journeyId}/pings/{pingId})
-- ============================================================================
create table if not exists public.journey_pings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  lat float8,
  lng float8,
  speed float8,
  created_at timestamptz not null default now()
);

alter table public.journey_pings enable row level security;

create index if not exists journey_pings_journey_id_idx on public.journey_pings (journey_id);

create policy "journey pings readable by any authenticated user"
  on public.journey_pings for select
  to authenticated
  using (true);

create policy "journey pings insertable by any authenticated user"
  on public.journey_pings for insert
  to authenticated
  with check (true);

-- ============================================================================
-- SOS EVENTS (was collections/sos_events/{eventId})
-- ============================================================================
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

alter table public.sos_events enable row level security;

create index if not exists sos_events_user_id_idx on public.sos_events (user_id);

create policy "sos events readable by any authenticated user"
  on public.sos_events for select
  to authenticated
  using (true);

create policy "sos events insertable by owner"
  on public.sos_events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sos events updatable by owner"
  on public.sos_events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- INCIDENTS (was collections/incidents/{incidentId})
-- insertable by anyone (anonymous reporting), never updatable by clients
-- ============================================================================
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

alter table public.incidents enable row level security;

create index if not exists incidents_reporter_id_idx on public.incidents (reporter_id);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);

create policy "incidents insertable by anyone (incl. anonymous)"
  on public.incidents for insert
  to anon, authenticated
  with check (true);

create policy "incidents readable by any authenticated user"
  on public.incidents for select
  to authenticated
  using (true);

-- ============================================================================
-- RISK ZONES (was collections/riskZones/{zoneId}) — read-only for clients
-- ============================================================================
create table if not exists public.risk_zones (
  id uuid primary key default gen_random_uuid(),
  center_lat float8,
  center_lng float8,
  radius_meters int,
  risk_score int not null default 0,
  incident_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.risk_zones enable row level security;

create policy "risk zones publicly readable"
  on public.risk_zones for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- STORAGE BUCKETS + POLICIES (replaces storage.rules)
-- incident-evidence: authenticated read, authenticated write (was: auth != null)
-- profile-photos:    authenticated read, owner write (was: auth.uid == uid)
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
-- sos-fanout fires on INSERT into sos_events
-- incident-moderation fires on INSERT into incidents
-- (replaces Firebase onDocumentCreated triggers)
-- ============================================================================
grant usage on schema pg_net to anon, authenticated, service_role;

create or replace function public.webhook_sos_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/sos-fanout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('request.headers', true)::json ->> 'apikey', '<SUPABASE_ANON_KEY>')
    ),
    body := jsonb_build_object('type', 'postgres', 'schema', TG_TABLE_SCHEMA, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW))
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
begin
  perform pg_net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/incident-moderation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('request.headers', true)::json ->> 'apikey', '<SUPABASE_ANON_KEY>')
    ),
    body := jsonb_build_object('type', 'postgres', 'schema', TG_TABLE_SCHEMA, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW))
  );
  return new;
end;
$$;

create trigger trg_incident_moderation
  after insert on public.incidents
  for each row execute function public.webhook_incident_moderation();