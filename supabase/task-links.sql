alter table public.tasks
add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

alter table public.tasks
add column if not exists budget_item_id uuid references public.budget_items(id) on delete set null;

create index if not exists tasks_vendor_id_idx on public.tasks(vendor_id);
create index if not exists tasks_budget_item_id_idx on public.tasks(budget_item_id);
