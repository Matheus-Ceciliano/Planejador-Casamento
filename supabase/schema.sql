create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.weddings (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null default 'Planejador de Casamento',
  groom_name text,
  bride_name text,
  wedding_date date,
  ceremony_time time,
  ceremony_place text,
  party_place text,
  planned_budget numeric(12,2) not null default 0,
  cover_url text,
  color_palette text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_members (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('owner','bride','groom','planner','viewer','noivo','noiva','cerimonialista')),
  can_edit boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

create or replace function public.is_wedding_member(target_wedding_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = target_wedding_id
      and user_id = auth.uid()
      and role in ('owner','bride','groom','planner','viewer','noivo','noiva','cerimonialista')
  );
$$;

create table if not exists public.guest_groups (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  side text not null default 'outros',
  responsible_name text,
  responsible_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tables (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  capacity integer not null default 8 check (capacity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  full_name text not null,
  phone text,
  group_id uuid references public.guest_groups(id) on delete set null,
  origin_group text,
  guest_type text not null default 'adulto',
  invite_status text not null default 'não enviado',
  companions integer not null default 0 check (companions >= 0),
  table_id uuid references public.tables(id) on delete set null,
  food_restriction text,
  notes text,
  gift_received boolean not null default false,
  rsvp_token text unique,
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.delete_empty_guest_group_after_guest_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.group_id is not null and not exists (
    select 1
    from public.guests
    where group_id = old.group_id
  ) then
    delete from public.guest_groups
    where id = old.group_id;
  end if;

  return null;
end;
$$;

delete from public.guest_groups gg
where not exists (
  select 1
  from public.guests g
  where g.group_id = gg.id
);

drop trigger if exists delete_empty_guest_group_after_guest_delete on public.guests;
create trigger delete_empty_guest_group_after_guest_delete
after delete on public.guests
for each row
execute function public.delete_empty_guest_group_after_guest_change();

drop trigger if exists delete_empty_guest_group_after_guest_group_update on public.guests;
create trigger delete_empty_guest_group_after_guest_group_update
after update of group_id on public.guests
for each row
when (old.group_id is distinct from new.group_id)
execute function public.delete_empty_guest_group_after_guest_change();

alter table public.guests
  add column if not exists rsvp_token text unique,
  add column if not exists invite_sent_at timestamptz;

create unique index if not exists guests_rsvp_token_idx
  on public.guests (rsvp_token)
  where rsvp_token is not null;

create table if not exists public.table_guests (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id)
);

create table if not exists public.budget_categories (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, name)
);

create table if not exists public.vendors (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  category text not null,
  contact_name text,
  phone text,
  email text,
  instagram text,
  site text,
  contracted_value numeric(12,2) not null default 0,
  paid_value numeric(12,2) not null default 0,
  due_date date,
  status text not null default 'pesquisando',
  contract_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  estimated_value numeric(12,2) not null default 0,
  contracted_value numeric(12,2) not null default 0,
  paid_value numeric(12,2) not null default 0,
  payment_status text not null default 'pendente',
  due_date date,
  payment_date date,
  payment_method text,
  vendor_id uuid references public.vendors(id) on delete set null,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists budget_items_wedding_vendor_unique
  on public.budget_items(wedding_id, vendor_id)
  where vendor_id is not null;

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

create table if not exists public.venues (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  instagram text,
  site text,
  max_capacity integer not null default 0,
  rental_value numeric(12,2) not null default 0,
  included_items text,
  allowed_time text,
  has_parking boolean not null default false,
  has_kitchen boolean not null default false,
  has_ac boolean not null default false,
  has_outdoor_area boolean not null default false,
  allows_external_decoration boolean not null default false,
  status text not null default 'pesquisando',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buffet_proposals (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  service_type text not null,
  price_per_person numeric(12,2) not null default 0,
  adults_count integer not null default 0,
  children_count integer not null default 0,
  special_count integer not null default 0,
  menu text,
  tasting_done boolean not null default false,
  tasting_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drink_items (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  drink_type text not null,
  liters numeric(10,2) not null default 0,
  units integer not null default 0,
  unit_value numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  responsible text not null,
  due_date date,
  priority text not null default 'média',
  status text not null default 'pendente',
  vendor_id uuid references public.vendors(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_vendor_id_idx on public.tasks(vendor_id);
create index if not exists tasks_budget_item_id_idx on public.tasks(budget_item_id);

create table if not exists public.task_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_checklist_items_task_id_idx on public.task_checklist_items(task_id);
create index if not exists task_checklist_items_wedding_id_idx on public.task_checklist_items(wedding_id);

create table if not exists public.timeline_items (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  time time not null,
  activity text not null,
  responsible text,
  place text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default uuid_generate_v4(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  category text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  file_url text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','weddings','wedding_members','guest_groups','guests','tables','table_guests',
    'budget_categories','budget_items','payment_installments','vendors','venues','buffet_proposals','drink_items',
    'tasks','task_checklist_items','timeline_items','files'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guests enable row level security;
alter table public.tables enable row level security;
alter table public.table_guests enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.payment_installments enable row level security;
alter table public.vendors enable row level security;
alter table public.venues enable row level security;
alter table public.buffet_proposals enable row level security;
alter table public.drink_items enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.timeline_items enable row level security;
alter table public.files enable row level security;

create policy "profiles own select" on public.profiles for select using (id = auth.uid());
create policy "profiles own insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "weddings insert authenticated" on public.weddings for insert with check (auth.uid() is not null);
create policy "weddings members select" on public.weddings for select using (created_by = auth.uid() or public.is_wedding_member(id));
create policy "weddings members update" on public.weddings for update using (created_by = auth.uid() or public.is_wedding_member(id)) with check (created_by = auth.uid() or public.is_wedding_member(id));
create policy "weddings members delete" on public.weddings for delete using (created_by = auth.uid() or public.is_wedding_member(id));

create policy "members select own weddings" on public.wedding_members for select using (user_id = auth.uid() or public.is_wedding_member(wedding_id));
create policy "members insert self or member" on public.wedding_members for insert with check (user_id = auth.uid() or public.is_wedding_member(wedding_id));
create policy "members update by member" on public.wedding_members for update using (public.is_wedding_member(wedding_id)) with check (public.is_wedding_member(wedding_id));
create policy "members delete by member" on public.wedding_members for delete using (public.is_wedding_member(wedding_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'guest_groups','guests','tables','table_guests','budget_categories','budget_items','payment_installments','vendors',
    'venues','buffet_proposals','drink_items','tasks','task_checklist_items','timeline_items','files'
  ]
  loop
    execute format('create policy "%I members select" on public.%I for select using (public.is_wedding_member(wedding_id))', table_name, table_name);
    execute format('create policy "%I members insert" on public.%I for insert with check (public.is_wedding_member(wedding_id))', table_name, table_name);
    execute format('create policy "%I members update" on public.%I for update using (public.is_wedding_member(wedding_id)) with check (public.is_wedding_member(wedding_id))', table_name, table_name);
    execute format('create policy "%I members delete" on public.%I for delete using (public.is_wedding_member(wedding_id))', table_name, table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('wedding-files', 'wedding-files', true)
on conflict (id) do nothing;

create policy "wedding files authenticated upload"
on storage.objects for insert
with check (bucket_id = 'wedding-files' and auth.uid() is not null);

create policy "wedding files authenticated read"
on storage.objects for select
using (bucket_id = 'wedding-files' and auth.uid() is not null);

create policy "wedding files authenticated delete"
on storage.objects for delete
using (bucket_id = 'wedding-files' and auth.uid() is not null);

-- ============================================================
-- Extensões documentadas em migrations separadas
-- ============================================================
-- whatsapp-invite.sql:
--   alter table public.guest_groups
--     add column if not exists rsvp_token text unique,
--     add column if not exists invite_sent_at timestamptz,
--     add column if not exists last_invite_sent_at timestamptz;
--
--   alter table public.guests
--     add column if not exists rsvp_token text unique,
--     add column if not exists invite_sent_at timestamptz;
-- ============================================================
