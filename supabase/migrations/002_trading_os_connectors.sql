-- Trading OS metadata, broker connections and strategy metrics.
-- Applied to the production Supabase project on 2026-10-04.

alter table public.trades
  add column if not exists broker text,
  add column if not exists account_label text,
  add column if not exists strategy text,
  add column if not exists setup text,
  add column if not exists timeframe text,
  add column if not exists session text,
  add column if not exists stop_loss numeric,
  add column if not exists take_profit numeric,
  add column if not exists planned_risk_pct numeric,
  add column if not exists planned_rr numeric,
  add column if not exists fees numeric,
  add column if not exists realized_pnl numeric,
  add column if not exists import_ref text,
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists tags jsonb not null default '[]'::jsonb;

create unique index if not exists trades_user_import_ref_uidx
  on public.trades(user_id, import_ref)
  where import_ref is not null;

create table if not exists public.broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  account_label text,
  connection_type text not null default 'read_only',
  status text not null default 'disconnected',
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.broker_connections enable row level security;

do $$ begin
  create policy "broker_connections_own"
  on public.broker_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace view public.trade_strategy_metrics
with (security_invoker = true)
as
select
  user_id,
  coalesce(nullif(strategy,''),'Unclassified') as strategy,
  coalesce(nullif(timeframe,''),'—') as timeframe,
  coalesce(nullif(session,''),'—') as session,
  count(*) filter (where status <> 'open') as trades,
  count(*) filter (
    where status <> 'open'
      and coalesce(realized_pnl,
        case when side='Short' then (entry-exit)*volume else (exit-entry)*volume end
      ) > 0
  ) as wins,
  avg(coalesce(realized_pnl,
    case when side='Short' then (entry-exit)*volume else (exit-entry)*volume end
  )) filter (where status <> 'open') as avg_pnl,
  sum(coalesce(realized_pnl,
    case when side='Short' then (entry-exit)*volume else (exit-entry)*volume end
  )) filter (where status <> 'open') as total_pnl
from public.trades
group by user_id, coalesce(nullif(strategy,''),'Unclassified'), coalesce(nullif(timeframe,''),'—'), coalesce(nullif(session,''),'—');
