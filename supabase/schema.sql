-- Cigar Cost Calculator - Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor.
-- This schema is ready for Supabase Auth + Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.cigars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  vitola text not null default '',
  normalized_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, normalized_key)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  total_cigars integer not null,
  total_egp numeric(14,2) not null,
  average_per_stick_egp numeric(14,2) not null,
  usdt_egp_rate numeric(12,4) not null,
  rate_source text not null check (rate_source in ('live','manual')),
  original_usd_total numeric(14,2),
  tax_usd numeric(14,2),
  quantity_fees_usd numeric(14,2),
  box_fees_usd numeric(14,2)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cigar_id uuid references public.cigars(id) on delete set null,
  cigar_name_snapshot text not null,
  vitola_snapshot text not null default '',
  quantity integer not null,
  price_per_stick_egp numeric(14,2) not null,
  allocation_mode text not null check (allocation_mode in ('automatic','manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.cigar_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cigar_id uuid not null references public.cigars(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  purchased_at timestamptz not null default now(),
  quantity integer not null,
  price_per_stick_egp numeric(14,2) not null,
  order_total_egp numeric(14,2) not null,
  usdt_egp_rate numeric(12,4) not null,
  rate_source text not null check (rate_source in ('live','manual'))
);

create index if not exists cigars_user_name_idx on public.cigars(user_id, normalized_name);
create index if not exists orders_user_date_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_user_idx on public.order_items(user_id);
create index if not exists price_history_user_cigar_date_idx on public.cigar_price_history(user_id, cigar_id, purchased_at desc);

alter table public.cigars enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cigar_price_history enable row level security;

-- Remove broad access before adding owner-only policies.
revoke all on public.cigars from anon;
revoke all on public.orders from anon;
revoke all on public.order_items from anon;
revoke all on public.cigar_price_history from anon;

grant select, insert, update, delete on public.cigars to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.cigar_price_history to authenticated;

-- Owner-only policies. Drop first so this script can be safely re-run.
drop policy if exists "Users can read their cigars" on public.cigars;
drop policy if exists "Users can insert their cigars" on public.cigars;
drop policy if exists "Users can update their cigars" on public.cigars;
drop policy if exists "Users can delete their cigars" on public.cigars;
create policy "Users can read their cigars" on public.cigars for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their cigars" on public.cigars for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their cigars" on public.cigars for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their cigars" on public.cigars for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their orders" on public.orders;
drop policy if exists "Users can insert their orders" on public.orders;
drop policy if exists "Users can update their orders" on public.orders;
drop policy if exists "Users can delete their orders" on public.orders;
create policy "Users can read their orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their orders" on public.orders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their orders" on public.orders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their orders" on public.orders for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their order items" on public.order_items;
drop policy if exists "Users can insert their order items" on public.order_items;
drop policy if exists "Users can update their order items" on public.order_items;
drop policy if exists "Users can delete their order items" on public.order_items;
create policy "Users can read their order items" on public.order_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their order items" on public.order_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their order items" on public.order_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their order items" on public.order_items for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their price history" on public.cigar_price_history;
drop policy if exists "Users can insert their price history" on public.cigar_price_history;
drop policy if exists "Users can update their price history" on public.cigar_price_history;
drop policy if exists "Users can delete their price history" on public.cigar_price_history;
create policy "Users can read their price history" on public.cigar_price_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their price history" on public.cigar_price_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their price history" on public.cigar_price_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their price history" on public.cigar_price_history for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep updated_at current when a cigar is edited.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cigars_set_updated_at on public.cigars;
create trigger cigars_set_updated_at before update on public.cigars for each row execute function public.set_updated_at();
