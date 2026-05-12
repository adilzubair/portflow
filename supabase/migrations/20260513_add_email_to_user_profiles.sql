alter table public.user_profiles
  add column if not exists email text;

-- Backfill email for existing rows from auth.users
update public.user_profiles p
set email = u.email
from auth.users u
where p.user_id = u.id;

-- Update trigger to capture email on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, approved)
  values (new.id, new.email, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
