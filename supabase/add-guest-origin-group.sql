alter table public.guests
add column if not exists origin_group text;

notify pgrst, 'reload schema';
