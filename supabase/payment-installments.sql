create table if not exists public.payment_installments (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  budget_item_id uuid references public.budget_items(id) on delete cascade,
  number integer not null,
  amount numeric(12,2) not null default 0,
  due_date date,
  paid_amount numeric(12,2) not null default 0,
  paid_at date,
  payment_method text,
  receipt_url text,
  status text not null default 'pendente',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_installments_status_check check (status in ('pendente','pago','vencido','cancelado'))
);

create index if not exists payment_installments_wedding_id_idx
  on public.payment_installments(wedding_id);

create index if not exists payment_installments_vendor_id_idx
  on public.payment_installments(vendor_id);

create index if not exists payment_installments_budget_item_id_idx
  on public.payment_installments(budget_item_id);

create unique index if not exists payment_installments_budget_item_number_unique
  on public.payment_installments(budget_item_id, number)
  where budget_item_id is not null;

alter table public.payment_installments enable row level security;

drop policy if exists "payment_installments members select" on public.payment_installments;
drop policy if exists "payment_installments members insert" on public.payment_installments;
drop policy if exists "payment_installments members update" on public.payment_installments;
drop policy if exists "payment_installments members delete" on public.payment_installments;

create policy "payment_installments members select"
on public.payment_installments for select
using (public.is_wedding_member(wedding_id));

create policy "payment_installments members insert"
on public.payment_installments for insert
with check (public.is_wedding_member(wedding_id));

create policy "payment_installments members update"
on public.payment_installments for update
using (public.is_wedding_member(wedding_id))
with check (public.is_wedding_member(wedding_id));

create policy "payment_installments members delete"
on public.payment_installments for delete
using (public.is_wedding_member(wedding_id));

notify pgrst, 'reload schema';
