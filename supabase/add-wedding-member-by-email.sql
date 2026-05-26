drop function if exists public.add_wedding_member_by_email(uuid, text, text, text);
drop function if exists public.add_wedding_member_by_email(text, text, text, uuid);

create or replace function public.add_wedding_member_by_email(
  member_email text,
  member_name text,
  member_role text,
  target_wedding_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  target_user_name text;
  target_user_email text;
begin
  if member_role not in ('noivo', 'noiva', 'cerimonialista') then
    raise exception 'Papel invalido.';
  end if;

  if not public.is_wedding_member(target_wedding_id) then
    raise exception 'Voce nao tem acesso a este casamento.';
  end if;

  select id, full_name, email
    into target_user_id, target_user_name, target_user_email
    from public.profiles
   where lower(email) = lower(trim(member_email))
   limit 1;

  if target_user_id is null then
    raise exception 'Este e-mail ainda nao tem cadastro no site.';
  end if;

  insert into public.wedding_members (
    wedding_id,
    user_id,
    name,
    email,
    role,
    can_edit
  )
  values (
    target_wedding_id,
    target_user_id,
    coalesce(nullif(trim(member_name), ''), target_user_name, target_user_email),
    target_user_email,
    member_role,
    true
  )
  on conflict (wedding_id, user_id)
  do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    can_edit = excluded.can_edit,
    updated_at = now();
end;
$$;

grant execute on function public.add_wedding_member_by_email(text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
