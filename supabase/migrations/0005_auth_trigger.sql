-- SafeYou-Campus: auto-provision a public.users row for every new auth.users row.
-- This is the Supabase equivalent of the Firebase "onUserCreate" safety net:
-- even if a user is created outside the app's sign-up flow (e.g. an email link,
-- OAuth provider, or admin invite), they get a base profile row immediately.
-- authService.signUp also upserts the profile, so the two are idempotent.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
