create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value_aed double precision not null default 0,
  total_invested_aed double precision not null default 0,
  total_gain_loss_aed double precision not null default 0,
  holdings_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, snapshot_date)
);

create or replace function public.set_portfolio_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists portfolio_snapshots_set_updated_at on public.portfolio_snapshots;

create trigger portfolio_snapshots_set_updated_at
before update on public.portfolio_snapshots
for each row
execute function public.set_portfolio_snapshots_updated_at();

alter table public.portfolio_snapshots enable row level security;

create policy "portfolio_snapshots_select_own"
on public.portfolio_snapshots
for select
using (auth.uid() = user_id);

create policy "portfolio_snapshots_insert_own"
on public.portfolio_snapshots
for insert
with check (auth.uid() = user_id);

create policy "portfolio_snapshots_update_own"
on public.portfolio_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "portfolio_snapshots_delete_own"
on public.portfolio_snapshots
for delete
using (auth.uid() = user_id);
