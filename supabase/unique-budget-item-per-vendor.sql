create unique index if not exists budget_items_wedding_vendor_unique
  on public.budget_items(wedding_id, vendor_id)
  where vendor_id is not null;
