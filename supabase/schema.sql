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


-- Multi-photo order editor RPC.
drop function if exists public.replace_order_contents(uuid,uuid,integer,numeric,numeric,numeric,numeric,text,numeric,numeric,text,text,jsonb,jsonb);
create or replace function public.replace_order_contents(
  p_order_id uuid, p_user_id uuid, p_total_cigars integer, p_total_egp numeric,
  p_average_per_stick_egp numeric, p_calculated_total_egp numeric, p_actual_total_egp numeric,
  p_supplier text, p_delivery_fee_usd numeric, p_other_fees_usd numeric, p_notes text,
  p_order_image_urls jsonb, p_items jsonb, p_history jsonb
) returns void language plpgsql set search_path to 'public' as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.orders where id=p_order_id and user_id=p_user_id) then raise exception 'Order not found'; end if;
  update public.orders set total_cigars=p_total_cigars,total_egp=p_total_egp,
    average_per_stick_egp=p_average_per_stick_egp,calculated_total_egp=p_calculated_total_egp,
    actual_total_egp=p_actual_total_egp,total_adjustment_egp=p_actual_total_egp-p_calculated_total_egp,
    supplier=coalesce(p_supplier,''),delivery_fee_usd=coalesce(p_delivery_fee_usd,0),
    other_fees_usd=coalesce(p_other_fees_usd,0),notes=coalesce(p_notes,''),
    order_image_urls=coalesce(p_order_image_urls,'[]'::jsonb),
    order_image_url=nullif(coalesce(p_order_image_urls->>0,''),'')
  where id=p_order_id and user_id=p_user_id;
  delete from public.cigar_price_history where order_id=p_order_id and user_id=p_user_id;
  delete from public.order_items where order_id=p_order_id and user_id=p_user_id;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))>0 then
    insert into public.order_items(order_id,user_id,cigar_id,cigar_name_snapshot,vitola_snapshot,quantity,price_per_stick_egp,allocation_mode,image_url,image_urls)
    select p_order_id,p_user_id,nullif(x.cigar_id,'')::uuid,x.cigar_name_snapshot,coalesce(x.vitola_snapshot,''),
      x.quantity,x.price_per_stick_egp,case when x.allocation_mode='automatic' then 'automatic' else 'manual' end,
      nullif(coalesce(x.image_urls->>0,''),''),coalesce(x.image_urls,'[]'::jsonb)
    from jsonb_to_recordset(p_items) as x(cigar_id text,cigar_name_snapshot text,vitola_snapshot text,quantity integer,price_per_stick_egp numeric,allocation_mode text,image_urls jsonb);
  end if;
  if jsonb_array_length(coalesce(p_history,'[]'::jsonb))>0 then
    insert into public.cigar_price_history(user_id,cigar_id,order_id,purchased_at,quantity,price_per_stick_egp,order_total_egp,usdt_egp_rate,rate_source,image_url,vitola_snapshot)
    select p_user_id,nullif(x.cigar_id,'')::uuid,p_order_id,x.purchased_at::timestamptz,x.quantity,x.price_per_stick_egp,
      x.order_total_egp,x.usdt_egp_rate,case when x.rate_source='manual' then 'manual' else 'live' end,
      nullif(coalesce(x.image_urls->>0,''),''),coalesce(x.vitola_snapshot,'')
    from jsonb_to_recordset(p_history) as x(cigar_id text,purchased_at text,quantity integer,price_per_stick_egp numeric,order_total_egp numeric,usdt_egp_rate numeric,rate_source text,image_urls jsonb,vitola_snapshot text);
  end if;
end;
$function$;

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

