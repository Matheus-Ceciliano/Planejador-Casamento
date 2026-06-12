create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

alter table public.wedding_members
  drop constraint if exists wedding_members_role_check;

alter table public.wedding_members
  add constraint wedding_members_role_check
  check (role in ('owner','bride','groom','planner','noivo','noiva','cerimonialista'));

create table if not exists public.wedding_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  token text unique not null,
  role text not null check (role in ('bride','groom','planner')),
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wedding_invites_wedding_id_idx
  on public.wedding_invites (wedding_id);

alter table public.wedding_invites
  add column if not exists invitee_email text;

create unique index if not exists wedding_invites_active_email_role_unique
  on public.wedding_invites(wedding_id, lower(invitee_email), role)
  where invitee_email is not null
    and used_at is null
    and is_revoked = false;

alter table public.wedding_invites enable row level security;

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
      and role in ('owner','bride','groom','planner','noivo','noiva','cerimonialista')
  );
$$;

create or replace function public.can_manage_wedding_members(target_wedding_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = target_wedding_id
      and user_id = auth.uid()
      and role in ('owner','bride','groom','noivo','noiva')
  );
$$;

drop policy if exists "wedding invites members select" on public.wedding_invites;
drop policy if exists "wedding invites managers insert" on public.wedding_invites;
drop policy if exists "wedding invites managers update" on public.wedding_invites;
drop policy if exists "wedding invites managers delete" on public.wedding_invites;

create policy "wedding invites members select"
on public.wedding_invites for select
using (public.is_wedding_member(wedding_id));

create policy "wedding invites managers insert"
on public.wedding_invites for insert
with check (public.can_manage_wedding_members(wedding_id));

create policy "wedding invites managers update"
on public.wedding_invites for update
using (public.can_manage_wedding_members(wedding_id))
with check (public.can_manage_wedding_members(wedding_id));

create policy "wedding invites managers delete"
on public.wedding_invites for delete
using (public.can_manage_wedding_members(wedding_id));

create or replace function public.normalize_member_role(member_role text)
returns text
language sql
immutable
as $$
  select case member_role
    when 'noivo' then 'groom'
    when 'noiva' then 'bride'
    when 'cerimonialista' then 'planner'
    else member_role
  end;
$$;

create or replace function public.create_wedding_invite(
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
  normalized_role text;
begin
  normalized_role := public.normalize_member_role(invite_role);

  if normalized_role not in ('bride','groom','planner') then
    raise exception 'Papel invalido.';
  end if;

  if not public.can_manage_wedding_members(target_wedding_id) then
    raise exception 'Voce nao tem permissao para gerar convites.';
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
    nullif(lower(trim(target_email)), ''),
    auth.uid(),
    now() + make_interval(days => coalesce(ttl_days, 7))
  )
  returning * into created_invite;

  return created_invite;
end;
$$;

create or replace function public.revoke_wedding_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.wedding_invites;
begin
  select * into invite_record
  from public.wedding_invites
  where id = invite_id;

  if invite_record.id is null then
    raise exception 'Convite nao encontrado.';
  end if;

  if not public.can_manage_wedding_members(invite_record.wedding_id) then
    raise exception 'Voce nao tem permissao para revogar este convite.';
  end if;

  update public.wedding_invites
  set is_revoked = true
  where id = invite_id;
end;
$$;

create or replace function public.get_wedding_invite_public(invite_token text)
returns table (
  id uuid,
  wedding_id uuid,
  wedding_name text,
  role text,
  expires_at timestamptz,
  used_at timestamptz,
  is_revoked boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    i.id,
    i.wedding_id,
    w.name as wedding_name,
    i.role,
    i.expires_at,
    i.used_at,
    i.is_revoked,
    case
      when i.id is null then 'not_found'
      when i.is_revoked then 'revoked'
      when i.used_at is not null then 'used'
      when i.expires_at is not null and i.expires_at < now() then 'expired'
      else 'active'
    end as status
  from public.wedding_invites i
  join public.weddings w on w.id = i.wedding_id
  where i.token = invite_token
  limit 1;
end;
$$;

create or replace function public.accept_wedding_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.wedding_invites;
  profile_record public.profiles;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select * into invite_record
  from public.wedding_invites
  where token = invite_token
  for update;

  if invite_record.id is null then
    raise exception 'Este link de convite nao existe ou foi digitado incorretamente.';
  end if;

  if invite_record.is_revoked then
    raise exception 'Este convite foi cancelado.';
  end if;

  if invite_record.used_at is not null then
    raise exception 'Este convite ja foi utilizado.';
  end if;

  if invite_record.expires_at is not null and invite_record.expires_at < now() then
    raise exception 'Este convite expirou. Peca um novo link ao administrador.';
  end if;

  if exists (
    select 1 from public.wedding_members
    where wedding_id = invite_record.wedding_id
      and user_id = auth.uid()
  ) then
    raise exception 'Voce ja faz parte deste planejamento.';
  end if;

  select * into profile_record
  from public.profiles
  where id = auth.uid();

  normalized_role := public.normalize_member_role(invite_record.role);

  insert into public.wedding_members (
    wedding_id,
    user_id,
    name,
    email,
    role,
    can_edit
  )
  values (
    invite_record.wedding_id,
    auth.uid(),
    coalesce(nullif(profile_record.full_name, ''), profile_record.email, auth.email()),
    coalesce(profile_record.email, auth.email()),
    normalized_role,
    true
  );

  update public.wedding_invites
  set used_by = auth.uid(),
      used_at = now()
  where id = invite_record.id;

  return invite_record.wedding_id;
end;
$$;

grant execute on function public.create_wedding_invite(uuid, text, integer, text) to authenticated;
grant execute on function public.revoke_wedding_invite(uuid) to authenticated;
grant execute on function public.get_wedding_invite_public(text) to anon, authenticated;
grant execute on function public.accept_wedding_invite(text) to authenticated;

notify pgrst, 'reload schema';
