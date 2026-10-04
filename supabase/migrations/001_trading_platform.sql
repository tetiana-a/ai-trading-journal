-- Trading Journal cloud schema
create extension if not exists pgcrypto;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  ticker text,
  side text,
  status text,
  trade_date date,
  deposit numeric,
  entry numeric,
  exit numeric,
  volume numeric,
  emotion text,
  entry_reason text,
  exit_reason text,
  notes text,
  source text default 'journal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, external_id)
);

create table if not exists public.prop_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm text not null,
  program text,
  account_size numeric,
  current_balance numeric,
  current_equity numeric,
  max_daily_loss_pct numeric,
  max_loss_pct numeric,
  profit_target_pct numeric,
  personal_daily_stop_pct numeric default 1,
  status text default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  source text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete cascade,
  provider text,
  model text,
  review text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text,
  rule_type text not null,
  rule jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  chat_id text,
  direction text not null,
  command text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trades enable row level security;
alter table public.prop_accounts enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.ai_reviews enable row level security;
alter table public.alerts enable row level security;
alter table public.telegram_events enable row level security;

do $$ begin
  create policy "trades_own" on public.trades for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "prop_accounts_own" on public.prop_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "knowledge_own" on public.knowledge_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ai_reviews_own" on public.ai_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "alerts_own" on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "telegram_events_own" on public.telegram_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
