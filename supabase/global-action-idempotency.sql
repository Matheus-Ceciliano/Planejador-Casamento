-- Idempotency constraints for critical actions.
-- Run after schema.sql and member-roles-permissions.sql.

alter table public.wedding_invites
  add column if not exists invitee_email text;

with duplicate_payments as (
  select
    id,
    row_number() over (
      partition by payment_id
      order by created_at desc, id desc
    ) as position
  from public.payment_history
  where payment_id is not null
)
update public.payment_history history
set payment_id = null
from duplicate_payments duplicate
where history.id = duplicate.id
  and duplicate.position > 1;

create unique index if not exists payment_history_payment_id_unique
  on public.payment_history(payment_id)
  where payment_id is not null;

with duplicate_invites as (
  select
    id,
    row_number() over (
      partition by wedding_id, lower(invitee_email), role
      order by created_at desc, id desc
    ) as position
  from public.wedding_invites
  where invitee_email is not null
    and used_at is null
    and is_revoked = false
)
update public.wedding_invites invite
set is_revoked = true
from duplicate_invites duplicate
where invite.id = duplicate.id
  and duplicate.position > 1;

create unique index if not exists wedding_invites_active_email_role_unique
  on public.wedding_invites(wedding_id, lower(invitee_email), role)
  where invitee_email is not null
    and used_at is null
    and is_revoked = false;

drop function if exists public.create_wedding_invite(uuid, text, integer);

create function public.create_wedding_invite(
  target_wedding_id uuid,
  invite_role text,
  ttl_days integer default 7,
  target_email text default null
)
returns public.wedding_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  created_invite public.wedding_invites;
  existing_invite public.wedding_invites;
  normalized_role text;
  normalized_email text;
begin
  normalized_role := public.normalize_member_role(invite_role);
  normalized_email := nullif(lower(trim(target_email)), '');

  if normalized_role not in ('bride','groom','planner','viewer') then
    raise exception 'Papel invalido.';
  end if;

  if not public.can_manage_wedding_members(target_wedding_id) then
    raise exception 'Voce nao tem permissao para gerar convites.';
  end if;

  update public.wedding_invites
  set is_revoked = true
  where wedding_id = target_wedding_id
    and used_at is null
    and is_revoked = false
    and expires_at is not null
    and expires_at < now();

  if normalized_email is not null then
    select * into existing_invite
    from public.wedding_invites
    where wedding_id = target_wedding_id
      and lower(invitee_email) = normalized_email
      and role = normalized_role
      and used_at is null
      and is_revoked = false
    limit 1;

    if existing_invite.id is not null then
      return existing_invite;
    end if;
  end if;

  insert into public.wedding_invites (
    wedding_id,
    token,
    role,
    invitee_email,
    created_by,
    expires_at
  )
  values (
    target_wedding_id,
    encode(extensions.gen_random_bytes(24), 'hex'),
    normalized_role,
    normalized_email,
    auth.uid(),
    now() + make_interval(days => coalesce(ttl_days, 7))
  )
  returning * into created_invite;

  return created_invite;
end;
$$;

grant execute on function public.create_wedding_invite(uuid, text, integer, text) to authenticated;

notify pgrst, 'reload schema';
