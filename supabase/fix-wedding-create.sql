alter table public.weddings
add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

drop policy if exists "weddings members select" on public.weddings;
drop policy if exists "weddings members update" on public.weddings;
drop policy if exists "weddings members delete" on public.weddings;

create policy "weddings members select"
on public.weddings for select
using (created_by = auth.uid() or public.is_wedding_member(id));

create policy "weddings members update"
on public.weddings for update
using (created_by = auth.uid() or public.is_wedding_member(id))
with check (created_by = auth.uid() or public.is_wedding_member(id));

create policy "weddings members delete"
on public.weddings for delete
using (created_by = auth.uid() or public.is_wedding_member(id));
