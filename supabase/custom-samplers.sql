alter table public.sales_order_items
  add column if not exists components_snapshot jsonb not null default '[]'::jsonb;

create table if not exists public.custom_samplers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  selling_price_egp numeric(14,2) not null default 0 check (selling_price_egp >= 0),
  components jsonb not null default '[]'::jsonb check (jsonb_typeof(components) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
create index if not exists custom_samplers_user_idx on public.custom_samplers(user_id, created_at desc);
alter table public.custom_samplers enable row level security;
revoke all on public.custom_samplers from anon;
grant select, insert, update, delete on public.custom_samplers to authenticated;
drop policy if exists "Custom samplers owner access" on public.custom_samplers;
create policy "Custom samplers owner access" on public.custom_samplers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop trigger if exists custom_samplers_set_updated_at on public.custom_samplers;
create trigger custom_samplers_set_updated_at before update on public.custom_samplers
  for each row execute function public.set_updated_at();
