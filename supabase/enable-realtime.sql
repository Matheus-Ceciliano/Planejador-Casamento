-- Execute este arquivo no Supabase SQL Editor se as tabelas ainda nao
-- estiverem habilitadas em Database > Replication > supabase_realtime.
--
-- Mantem RLS ligado. O Realtime continua respeitando as policies existentes.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'weddings',
    'wedding_members',
    'guest_groups',
    'guests',
    'tables',
    'table_guests',
    'vendors',
    'budget_items',
    'budget_categories',
    'venues',
    'buffet_proposals',
    'drink_items',
    'tasks',
    'task_checklist_items',
    'timeline_items',
    'files'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
