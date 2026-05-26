update public.vendors
set category = case
  when category in ('Fotografia', 'Filmagem') then 'Foto e Vídeo'
  when category in ('Música', 'DJ') then 'Música / DJ'
  when category in ('Doces', 'Bolo') then 'Doces e Bolo'
  when category in ('Vestido', 'Terno') then 'Roupas dos Noivos'
  when category in ('Maquiagem', 'Cabelo') then 'Beleza da Noiva'
  else category
end
where category in ('Fotografia', 'Filmagem', 'Música', 'DJ', 'Doces', 'Bolo', 'Vestido', 'Terno', 'Maquiagem', 'Cabelo');

update public.budget_items
set category = case
  when category in ('Fotografia', 'Filmagem') then 'Foto e Vídeo'
  when category in ('Música', 'DJ') then 'Música / DJ'
  when category in ('Doces', 'Bolo') then 'Doces e Bolo'
  when category in ('Vestido', 'Terno') then 'Roupas dos Noivos'
  when category in ('Maquiagem', 'Cabelo') then 'Beleza da Noiva'
  else category
end
where category in ('Fotografia', 'Filmagem', 'Música', 'DJ', 'Doces', 'Bolo', 'Vestido', 'Terno', 'Maquiagem', 'Cabelo');

delete from public.budget_categories
where name in ('Fotografia', 'Filmagem', 'Música', 'DJ', 'Doces', 'Bolo', 'Vestido', 'Terno', 'Maquiagem', 'Cabelo');
