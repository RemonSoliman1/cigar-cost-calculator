-- Track when cigar and accessory purchases physically arrive.
-- Existing purchase records are treated as received to preserve current stock.
alter table public.orders add column if not exists received_at timestamptz;
alter table if exists public.accessory_purchases add column if not exists received_at timestamptz;

update public.orders
set received_at = created_at
where received_at is null
  and created_at < timestamptz '2026-10-10 12:26:49+00';

do $$
begin
  if to_regclass('public.accessory_purchases') is not null then
    execute $sql$
      update public.accessory_purchases
      set received_at = purchased_at
      where received_at is null
        and purchased_at < timestamptz '2026-10-10 12:26:49+00'
    $sql$;
  end if;
end;
$$;
