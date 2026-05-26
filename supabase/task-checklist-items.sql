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

alter table public.task_checklist_items enable row level security;

drop trigger if exists set_task_checklist_items_updated_at on public.task_checklist_items;
create trigger set_task_checklist_items_updated_at
before update on public.task_checklist_items
for each row execute function public.set_updated_at();

drop policy if exists "task_checklist_items members select" on public.task_checklist_items;
drop policy if exists "task_checklist_items members insert" on public.task_checklist_items;
drop policy if exists "task_checklist_items members update" on public.task_checklist_items;
drop policy if exists "task_checklist_items members delete" on public.task_checklist_items;

create policy "task_checklist_items members select"
on public.task_checklist_items
for select
using (public.is_wedding_member(wedding_id));

create policy "task_checklist_items members insert"
on public.task_checklist_items
for insert
with check (public.is_wedding_member(wedding_id));

create policy "task_checklist_items members update"
on public.task_checklist_items
for update
using (public.is_wedding_member(wedding_id))
with check (public.is_wedding_member(wedding_id));

create policy "task_checklist_items members delete"
on public.task_checklist_items
for delete
using (public.is_wedding_member(wedding_id));
