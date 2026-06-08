-- Diagnostico: fornecedores com mais de um item financeiro vinculado.
select
  wedding_id,
  vendor_id,
  count(*) as total
from public.budget_items
where vendor_id is not null
group by wedding_id, vendor_id
having count(*) > 1;

begin;

-- Consolida duplicados por wedding_id + vendor_id antes de criar a trava.
-- Mantem o item mais antigo e remove os demais.
with duplicate_groups as (
  select
    wedding_id,
    vendor_id,
    array_agg(id order by created_at asc, id asc) as ids,
    max(estimated_value) as estimated_value,
    max(contracted_value) as contracted_value,
    least(max(contracted_value), sum(coalesce(paid_value, 0))) as paid_value,
    min(due_date) filter (where due_date is not null) as due_date,
    (array_agg(receipt_url order by created_at asc, id asc) filter (where nullif(receipt_url, '') is not null))[1] as receipt_url,
    string_agg(distinct nullif(notes, ''), E'\n') filter (where nullif(notes, '') is not null) as notes
  from public.budget_items
  where vendor_id is not null
  group by wedding_id, vendor_id
  having count(*) > 1
),
merged as (
  select
    ids[1] as keep_id,
    ids[2:array_length(ids, 1)] as delete_ids,
    estimated_value,
    contracted_value,
    paid_value,
    due_date,
    receipt_url,
    notes
  from duplicate_groups
),
updated as (
  update public.budget_items item
  set
    estimated_value = greatest(item.estimated_value, merged.estimated_value),
    contracted_value = greatest(item.contracted_value, merged.contracted_value),
    paid_value = greatest(item.paid_value, merged.paid_value),
    payment_status = case
      when greatest(item.paid_value, merged.paid_value) <= 0 then 'pendente'
      when greatest(item.paid_value, merged.paid_value) < greatest(item.contracted_value, merged.contracted_value) then 'pago parcialmente'
      else 'pago'
    end,
    due_date = coalesce(item.due_date, merged.due_date),
    receipt_url = coalesce(nullif(item.receipt_url, ''), merged.receipt_url),
    notes = nullif(concat_ws(E'\n', nullif(item.notes, ''), merged.notes), ''),
    updated_at = now()
  from merged
  where item.id = merged.keep_id
  returning merged.delete_ids
)
delete from public.budget_items item
using updated
where item.id = any(updated.delete_ids);

create unique index if not exists budget_items_wedding_vendor_unique
  on public.budget_items(wedding_id, vendor_id)
  where vendor_id is not null;

commit;
