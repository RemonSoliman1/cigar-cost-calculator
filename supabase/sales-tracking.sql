-- Sync per-item selling prices across devices for each signed-in user.
create table if not exists public.sales_tracking_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_key text not null,
  item_type text not null default 'Cigar',
  item_name text not null default '',
  sale_price numeric(14,2),
  sale_price_basis text,
  entry_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_key)
);

create index if not exists sales_tracking_entries_user_idx
  on public.sales_tracking_entries(user_id, updated_at desc);

alter table public.sales_tracking_entries enable row level security;
revoke all on public.sales_tracking_entries from anon;
grant select, insert, update, delete on public.sales_tracking_entries to authenticated;
drop policy if exists "Sales tracking entries owner access" on public.sales_tracking_entries;
create policy "Sales tracking entries owner access" on public.sales_tracking_entries
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists sales_tracking_entries_set_updated_at on public.sales_tracking_entries;
create trigger sales_tracking_entries_set_updated_at before update on public.sales_tracking_entries
  for each row execute function public.set_updated_at();
