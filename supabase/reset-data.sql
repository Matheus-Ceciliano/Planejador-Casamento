-- ⚠️  CUIDADO: apaga TODOS os dados do banco, incluindo usuários.
-- As tabelas, funções, policies e configurações de realtime são preservadas.
-- Execute no Supabase SQL Editor.

truncate table
  public.files,
  public.timeline_items,
  public.task_checklist_items,
  public.tasks,
  public.drink_items,
  public.buffet_proposals,
  public.venues,
  public.budget_items,
  public.vendors,
  public.budget_categories,
  public.table_guests,
  public.guests,
  public.tables,
  public.guest_groups,
  public.wedding_members,
  public.weddings,
  public.profiles
restart identity cascade;

-- Apaga todos os usuários do Supabase Auth
-- (cascateia para public.profiles automaticamente)
delete from auth.users;

-- Recria o trigger de criação de perfil para novos cadastros funcionarem
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

