create table if not exists public.api_rate_limits (
  scope text not null,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket, window_start)
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_bucket text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_request_count integer;
begin
  if p_window_seconds <= 0 or p_limit <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (scope, bucket, window_start, request_count)
  values (p_scope, p_bucket, v_window_start, 1)
  on conflict (scope, bucket, window_start)
  do update
    set request_count = public.api_rate_limits.request_count + 1,
        updated_at = now()
  returning request_count into v_request_count;

  allowed := v_request_count <= p_limit;
  remaining := greatest(p_limit - v_request_count, 0);
  reset_at := v_reset_at;
  return next;
end;
$$;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to authenticated;

create index if not exists api_rate_limits_updated_at_idx
on public.api_rate_limits (updated_at);
