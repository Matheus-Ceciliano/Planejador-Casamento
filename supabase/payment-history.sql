create table if not exists public.payment_history (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  ap_number text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  payment_id uuid,
  amount numeric(12,2) not null default 0,
  payment_method text,
  payment_date date,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  notes text,
  receipt_file_url text,
  status text not null default 'confirmed' check (status in ('confirmed', 'canceled')),
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, ap_number)
);

create index if not exists payment_history_wedding_id_idx on public.payment_history(wedding_id);
create index if not exists payment_history_vendor_id_idx on public.payment_history(vendor_id);
create index if not exists payment_history_budget_item_id_idx on public.payment_history(budget_item_id);
create index if not exists payment_history_status_idx on public.payment_history(status);

drop trigger if exists set_payment_history_updated_at on public.payment_history;
create trigger set_payment_history_updated_at
before update on public.payment_history
for each row execute function public.set_updated_at();

alter table public.payment_history enable row level security;

drop policy if exists "payment_history members select" on public.payment_history;
drop policy if exists "payment_history members insert" on public.payment_history;
drop policy if exists "payment_history members update" on public.payment_history;
drop policy if exists "payment_history members delete" on public.payment_history;

create policy "payment_history members select"
on public.payment_history for select
using (public.is_wedding_member(wedding_id));

create policy "payment_history members insert"
on public.payment_history for insert
with check (public.is_wedding_member(wedding_id));

create policy "payment_history members update"
on public.payment_history for update
using (public.is_wedding_member(wedding_id))
with check (public.is_wedding_member(wedding_id));

create policy "payment_history members delete"
on public.payment_history for delete
using (public.is_wedding_member(wedding_id));

notify pgrst, 'reload schema';
