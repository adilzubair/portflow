-- Ensure the email column exists (may be missing on instances where the prior migration partially applied).
alter table public.user_profiles
  add column if not exists email text;

-- Backfill emails for user_profiles rows created before the email column existed.
-- The original migration used ON CONFLICT DO NOTHING which skipped existing rows.
update public.user_profiles up
set email = au.email
from auth.users au
where up.user_id = au.id
  and up.email is null;

-- Also update the trigger so future conflicts update the email instead of silently skipping.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, approved)
  values (new.id, new.email, false)
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;
