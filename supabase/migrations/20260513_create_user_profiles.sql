create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles enable row level security;

-- Users can read their own approval status (used by middleware)
drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

-- Auto-create an unapproved profile for every new signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, approved)
  values (new.id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: all existing users are approved
insert into public.user_profiles (user_id, approved)
select id, true from auth.users
on conflict (user_id) do nothing;
