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

notify pgrst, 'reload schema';
