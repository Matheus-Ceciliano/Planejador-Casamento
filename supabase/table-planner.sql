create extension if not exists "uuid-ossp";

alter table public.tables
  add column if not exists type text not null default 'Outros';

with duplicate_names as (
  select
    id,
    row_number() over (
      partition by wedding_id, lower(name)
      order by created_at, id
    ) as position
  from public.tables
)
update public.tables target
set name = concat(target.name, ' ', duplicate_names.position)
from duplicate_names
where target.id = duplicate_names.id
  and duplicate_names.position > 1;

create unique index if not exists tables_wedding_name_unique
  on public.tables(wedding_id, lower(name));

create unique index if not exists table_guests_wedding_guest_unique
  on public.table_guests(wedding_id, guest_id);

create or replace function public.can_edit_wedding(target_wedding_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_members
    where wedding_id = target_wedding_id
      and user_id = auth.uid()
      and can_edit = true
      and role <> 'viewer'
  );
$$;

drop policy if exists "tables members select" on public.tables;
drop policy if exists "tables members insert" on public.tables;
drop policy if exists "tables members update" on public.tables;
drop policy if exists "tables members delete" on public.tables;
drop policy if exists "tables editors insert" on public.tables;
drop policy if exists "tables editors update" on public.tables;
drop policy if exists "tables editors delete" on public.tables;
drop policy if exists "table_guests members select" on public.table_guests;
drop policy if exists "table_guests members insert" on public.table_guests;
drop policy if exists "table_guests members update" on public.table_guests;
drop policy if exists "table_guests members delete" on public.table_guests;
drop policy if exists "table_guests editors insert" on public.table_guests;
drop policy if exists "table_guests editors update" on public.table_guests;
drop policy if exists "table_guests editors delete" on public.table_guests;

create policy "tables members select"
on public.tables for select
using (public.is_wedding_member(wedding_id));

create policy "tables editors insert"
on public.tables for insert
with check (public.can_edit_wedding(wedding_id));

create policy "tables editors update"
on public.tables for update
using (public.can_edit_wedding(wedding_id))
with check (public.can_edit_wedding(wedding_id));

create policy "tables editors delete"
on public.tables for delete
using (public.can_edit_wedding(wedding_id));

create policy "table_guests members select"
on public.table_guests for select
using (public.is_wedding_member(wedding_id));

create policy "table_guests editors insert"
on public.table_guests for insert
with check (public.can_edit_wedding(wedding_id));

create policy "table_guests editors update"
on public.table_guests for update
using (public.can_edit_wedding(wedding_id))
with check (public.can_edit_wedding(wedding_id));

create policy "table_guests editors delete"
on public.table_guests for delete
using (public.can_edit_wedding(wedding_id));

create or replace function public.validate_table_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_table public.tables;
  target_guest public.guests;
  occupied integer;
begin
  select * into target_table
  from public.tables
  where id = new.table_id
  for update;

  select * into target_guest
  from public.guests
  where id = new.guest_id;

  if target_table.id is null or target_guest.id is null then
    raise exception 'Mesa ou convidado nao encontrado.';
  end if;

  if target_table.wedding_id <> new.wedding_id
     or target_guest.wedding_id <> new.wedding_id then
    raise exception 'Mesa e convidado devem pertencer ao mesmo casamento.';
  end if;

  if lower(coalesce(target_guest.invite_status, '')) = 'recusado' then
    raise exception 'Convidado recusado nao pode ser alocado em mesa.';
  end if;

  select count(*) into occupied
  from public.table_guests
  where table_id = new.table_id
    and id <> coalesce(new.id, uuid_nil());

  if occupied >= target_table.capacity then
    raise exception 'Esta mesa nao possui lugares livres.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_table_assignment_before_write on public.table_guests;
create trigger validate_table_assignment_before_write
before insert or update on public.table_guests
for each row execute function public.validate_table_assignment();

create or replace function public.validate_table_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  occupied integer;
begin
  select count(*) into occupied
  from public.table_guests
  where table_id = new.id;

  if new.capacity < occupied then
    raise exception 'A capacidade nao pode ser menor que os lugares ocupados.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_table_capacity_before_update on public.tables;
create trigger validate_table_capacity_before_update
before update of capacity on public.tables
for each row execute function public.validate_table_capacity();

create or replace function public.assign_guests_to_table(
  target_table_id uuid,
  target_guest_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_table public.tables;
  occupied integer;
  required_seats integer;
begin
  select * into target_table
  from public.tables
  where id = target_table_id
  for update;

  if target_table.id is null then
    raise exception 'Mesa nao encontrada.';
  end if;

  if not public.can_edit_wedding(target_table.wedding_id) then
    raise exception 'Voce nao tem permissao para organizar esta mesa.';
  end if;

  if coalesce(array_length(target_guest_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um convidado.';
  end if;

  if exists (
    select 1
    from unnest(target_guest_ids) selected(guest_id)
    left join public.guests guest on guest.id = selected.guest_id
    where guest.id is null
      or guest.wedding_id <> target_table.wedding_id
      or lower(coalesce(guest.invite_status, '')) = 'recusado'
  ) then
    raise exception 'A selecao possui convidado invalido ou recusado.';
  end if;

  select count(*) into occupied
  from public.table_guests
  where table_id = target_table_id;

  select count(*) into required_seats
  from unnest(target_guest_ids) selected(guest_id)
  where not exists (
    select 1
    from public.table_guests assignment
    where assignment.guest_id = selected.guest_id
      and assignment.table_id = target_table_id
  );

  if occupied + required_seats > target_table.capacity then
    raise exception 'Essa mesa possui apenas % lugares livres.', greatest(0, target_table.capacity - occupied);
  end if;

  update public.table_guests
  set table_id = target_table_id,
      wedding_id = target_table.wedding_id
  where guest_id = any(target_guest_ids)
    and table_id <> target_table_id;

  insert into public.table_guests (wedding_id, table_id, guest_id)
  select target_table.wedding_id, target_table_id, selected.guest_id
  from unnest(target_guest_ids) selected(guest_id)
  where not exists (
    select 1
    from public.table_guests assignment
    where assignment.guest_id = selected.guest_id
  );
end;
$$;

grant execute on function public.assign_guests_to_table(uuid, uuid[]) to authenticated;

create or replace function public.sync_guest_table_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.guests
    set table_id = null
    where id = old.guest_id
      and table_id = old.table_id;
    return old;
  end if;

  update public.guests
  set table_id = new.table_id
  where id = new.guest_id;

  if tg_op = 'UPDATE' and old.guest_id <> new.guest_id then
    update public.guests
    set table_id = null
    where id = old.guest_id
      and table_id = old.table_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_guest_table_id_after_write on public.table_guests;
create trigger sync_guest_table_id_after_write
after insert or update or delete on public.table_guests
for each row execute function public.sync_guest_table_id();

create or replace function public.remove_refused_guest_from_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.invite_status, '')) = 'recusado'
     and lower(coalesce(old.invite_status, '')) <> 'recusado' then
    delete from public.table_guests
    where guest_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists remove_refused_guest_from_table_after_update on public.guests;
create trigger remove_refused_guest_from_table_after_update
after update of invite_status on public.guests
for each row execute function public.remove_refused_guest_from_table();

update public.guests
set table_id = null
where table_id is not null
  and lower(coalesce(invite_status, '')) = 'recusado';

delete from public.table_guests assignment
using public.guests guest
where guest.id = assignment.guest_id
  and lower(coalesce(guest.invite_status, '')) = 'recusado';

with legacy_assignments as (
  select
    guest.wedding_id,
    guest.table_id,
    guest.id as guest_id,
    row_number() over (
      partition by guest.table_id
      order by guest.created_at, guest.id
    ) as seat_number,
    target.capacity
  from public.guests guest
  join public.tables target on target.id = guest.table_id
  where guest.table_id is not null
)
insert into public.table_guests (wedding_id, table_id, guest_id)
select wedding_id, table_id, guest_id
from legacy_assignments
where seat_number <= capacity
on conflict (guest_id) do nothing;

update public.guests guest
set table_id = null
where guest.table_id is not null
  and not exists (
    select 1
    from public.table_guests assignment
    where assignment.guest_id = guest.id
      and assignment.table_id = guest.table_id
  );

notify pgrst, 'reload schema';
