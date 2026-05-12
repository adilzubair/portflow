-- Tracks per-user AI token usage and cost for billing/monitoring.
-- Not exposed to users — admin-only via Supabase dashboard or service-role queries.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,           -- 'openai' | 'openrouter'
  model text not null,              -- e.g. 'gpt-4o-mini', 'nvidia/nemotron-nano-12b-v2-vl:free'
  request_kind text not null,       -- e.g. 'holdings_extract'
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_usage_user_id_created_at_idx
  on public.ai_usage (user_id, created_at desc);

create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

-- Users can insert their own usage rows (the screenshot import API writes
-- one row per extraction using the user's authenticated session).
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

-- No SELECT / UPDATE / DELETE policy — admin-only.
