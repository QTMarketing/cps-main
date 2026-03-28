-- Ensure required extension for UUID generation (Supabase usually has this)
create extension if not exists pgcrypto;

-- 1) Create checks table if it does not exist with required columns
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete restrict,
  check_number integer not null,
  created_at timestamptz not null default now(),

  vendor_id uuid,
  store_id uuid,
  amount numeric(12,2),
  memo text,
  user_id uuid,
  invoice_url text,
  status text not null default 'ISSUED' check (status in ('ISSUED','CLEARED','VOIDED'))
);

-- 2) Ensure column types/constraints on existing table
-- check_number should be integer
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='checks' and column_name='check_number' and data_type <> 'integer'
  ) then
    alter table public.checks alter column check_number type integer using check_number::integer;
  end if;
end $$;

-- created_at timestamp with time zone default now()
alter table public.checks alter column created_at type timestamptz;
alter table public.checks alter column created_at set default now();

-- bank_id fk
alter table public.checks
  add constraint if not exists checks_bank_id_fkey foreign key (bank_id) references public.banks(id) on delete restrict;

-- 3) Add columns if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='vendor_id'
  ) then
    alter table public.checks add column vendor_id uuid;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='store_id'
  ) then
    alter table public.checks add column store_id uuid;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='amount'
  ) then
    alter table public.checks add column amount numeric(12,2);
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='memo'
  ) then
    alter table public.checks add column memo text;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='user_id'
  ) then
    alter table public.checks add column user_id uuid;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='invoice_url'
  ) then
    alter table public.checks add column invoice_url text;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='checks' and column_name='status'
  ) then
    alter table public.checks add column status text not null default 'ISSUED' check (status in ('ISSUED','CLEARED','VOIDED'));
  end if;
end $$;

-- 4) Add unique constraint for per-bank sequence uniqueness
alter table public.checks
  add constraint if not exists checks_bank_id_check_number_key unique (bank_id, check_number);

-- Optional: helpful indexes
create index if not exists idx_checks_created_at on public.checks (created_at desc);
create index if not exists idx_checks_vendor on public.checks (vendor_id);
create index if not exists idx_checks_store on public.checks (store_id);
create index if not exists idx_checks_user on public.checks (user_id);


