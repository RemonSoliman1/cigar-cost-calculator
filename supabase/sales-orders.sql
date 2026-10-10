-- Customer directory and outgoing customer sales.
create table if not exists public.sales_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_key text not null,
  name text not null,
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, customer_key)
);
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.sales_customers(id) on delete set null,
  customer_key_snapshot text,
  customer_name_snapshot text not null default 'Walk-in',
  customer_phone_snapshot text not null default '',
  customer_address_snapshot text not null default '',
  sale_date date not null default current_date,
  payment_method text not null default 'Cash',
  subtotal_egp numeric(14,2) not null default 0 check (subtotal_egp >= 0),
  item_discount_egp numeric(14,2) not null default 0 check (item_discount_egp >= 0),
  order_discount_egp numeric(14,2) not null default 0 check (order_discount_egp >= 0),
  total_paid_egp numeric(14,2) not null default 0 check (total_paid_egp >= 0),
  profit_egp numeric(14,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_key text not null,
  item_type text not null check (item_type in ('Cigar','Accessory')),
  item_name_snapshot text not null,
  item_details_snapshot text not null default '',
  quantity integer not null check (quantity > 0),
  stock_multiplier integer not null default 1 check (stock_multiplier > 0),
  unit_price_egp numeric(14,2) not null check (unit_price_egp >= 0),
  item_discount_egp numeric(14,2) not null default 0 check (item_discount_egp >= 0),
  unit_cost_egp numeric(14,2) not null default 0 check (unit_cost_egp >= 0),
  created_at timestamptz not null default now()
);
create index if not exists sales_customers_user_key_idx on public.sales_customers(user_id, customer_key);
create index if not exists sales_orders_user_date_idx on public.sales_orders(user_id, sale_date desc, created_at desc);
create index if not exists sales_orders_customer_idx on public.sales_orders(user_id, customer_id, sale_date desc);
create index if not exists sales_order_items_user_order_idx on public.sales_order_items(user_id, sales_order_id);
create index if not exists sales_orders_customer_fk_idx on public.sales_orders(customer_id);
create index if not exists sales_order_items_parent_fk_idx on public.sales_order_items(sales_order_id);
alter table public.sales_customers enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
revoke all on public.sales_customers from anon;
revoke all on public.sales_orders from anon;
revoke all on public.sales_order_items from anon;
grant select, insert, update, delete on public.sales_customers to authenticated;
grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_items to authenticated;
drop policy if exists "Sales customers owner access" on public.sales_customers;
create policy "Sales customers owner access" on public.sales_customers for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Sales orders owner access" on public.sales_orders;
create policy "Sales orders owner access" on public.sales_orders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (customer_id is null or exists (select 1 from public.sales_customers c where c.id=customer_id and c.user_id=(select auth.uid()))));
drop policy if exists "Sales order items owner access" on public.sales_order_items;
create policy "Sales order items owner access" on public.sales_order_items for all to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from public.sales_orders o where o.id=sales_order_id and o.user_id=(select auth.uid())))
  with check ((select auth.uid()) = user_id and exists (select 1 from public.sales_orders o where o.id=sales_order_id and o.user_id=(select auth.uid())));
drop trigger if exists sales_customers_set_updated_at on public.sales_customers;
create trigger sales_customers_set_updated_at before update on public.sales_customers for each row execute function public.set_updated_at();
drop trigger if exists sales_orders_set_updated_at on public.sales_orders;
create trigger sales_orders_set_updated_at before update on public.sales_orders for each row execute function public.set_updated_at();

