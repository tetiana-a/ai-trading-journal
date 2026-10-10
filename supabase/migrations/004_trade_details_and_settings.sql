-- Trade review details and the trader's own lists.
--
-- trades.details holds what the review tools add to a trade and the fixed columns do not cover:
--   marks      execution marks: ["plan"] or the ids of the mistakes made
--   checklist  {"done": [...], "missed": [...]} ids of the pre-entry checklist items
--   riskMoney  money at risk when the position was opened (the base of R)
--   mae, mfe   worst and best floating result while the position was open, in account currency
--   playbook   name of the setup template that was applied
--   shots      which MT5 chart pictures are already attached: "open", "close"
--
-- journal_settings keeps one row per user: the mistake list, the checklist, setup templates
-- and the rule chosen for each week, so every device shows the same lists.

alter table public.trades
  add column if not exists details jsonb not null default '{}'::jsonb;

create table if not exists public.journal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.journal_settings enable row level security;

do $$ begin
  create policy "journal_settings_own"
  on public.journal_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
