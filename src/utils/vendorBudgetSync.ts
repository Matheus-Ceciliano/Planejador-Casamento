import { BudgetItem, Vendor } from '../types';
import { supabase } from '../lib/supabase';
import { vendorToBudgetPayload } from './finance';

type BudgetTableApi = {
  create: (payload: Partial<BudgetItem>) => Promise<BudgetItem>;
  update: (id: string, payload: Partial<BudgetItem>) => Promise<BudgetItem>;
};

async function findBudgetItemByVendor(weddingId: string, vendorId: string) {
  const { data, error } = await supabase
    .from('budget_items')
    .select('*')
    .eq('wedding_id', weddingId)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as BudgetItem | null) ?? null;
}

function suppressionKey(weddingId: string) {
  return `vendor-budget-sync:suppressed:${weddingId}`;
}

function readSuppressed(weddingId: string) {
  if (typeof window === 'undefined') return new Set<string>();

  try {
    const raw = window.localStorage.getItem(suppressionKey(weddingId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeSuppressed(weddingId: string, values: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(suppressionKey(weddingId), JSON.stringify([...values]));
}

export function suppressVendorBudgetAutoCreate(weddingId: string, vendorId: string) {
  const suppressed = readSuppressed(weddingId);
  suppressed.add(vendorId);
  writeSuppressed(weddingId, suppressed);
}

export function clearVendorBudgetAutoCreateSuppression(weddingId: string, vendorId: string) {
  const suppressed = readSuppressed(weddingId);
  if (!suppressed.delete(vendorId)) return;
  writeSuppressed(weddingId, suppressed);
}

export function isVendorBudgetAutoCreateSuppressed(weddingId: string, vendorId: string) {
  return readSuppressed(weddingId).has(vendorId);
}

function sameNullableDate(left?: string | null, right?: string | null) {
  return (left || null) === (right || null);
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function needsBudgetSync(item: BudgetItem, payload: ReturnType<typeof vendorToBudgetPayload>) {
  return (
    item.name !== payload.name ||
    item.category !== payload.category ||
    numberValue(item.estimated_value) !== numberValue(payload.estimated_value) ||
    numberValue(item.contracted_value) !== numberValue(payload.contracted_value) ||
    numberValue(item.paid_value) !== numberValue(payload.paid_value) ||
    item.payment_status !== payload.payment_status ||
    !sameNullableDate(item.due_date, payload.due_date) ||
    (item.description ?? null) !== (payload.description ?? null) ||
    (item.notes ?? null) !== (payload.notes ?? null)
  );
}

export async function syncVendorBudgetItem(
  vendor: Vendor,
  existingItems: BudgetItem[],
  budgetItems: BudgetTableApi,
  options: { debug?: boolean; forceCreate?: boolean } = {}
) {
  const payload = vendorToBudgetPayload(vendor);
  const existing = (await findBudgetItemByVendor(vendor.wedding_id, vendor.id)) ?? existingItems.find((item) => item.vendor_id === vendor.id && item.wedding_id === vendor.wedding_id);

  if (options.debug) console.log('[vendor-budget-sync] fornecedor encontrado', vendor);

  try {
    if (existing) {
      clearVendorBudgetAutoCreateSuppression(vendor.wedding_id, vendor.id);

      if (needsBudgetSync(existing, payload)) {
        const updated = await budgetItems.update(existing.id, payload as Partial<BudgetItem>);
        if (options.debug) console.log('[vendor-budget-sync] item financeiro atualizado', updated);
        return updated;
      }

      if (options.debug) console.log('[vendor-budget-sync] item financeiro já sincronizado', existing);
      return existing;
    }

    if (!options.forceCreate && isVendorBudgetAutoCreateSuppressed(vendor.wedding_id, vendor.id)) {
      if (options.debug) console.log('[vendor-budget-sync] recriação automática bloqueada por exclusão manual', vendor.id);
      return null;
    }

    try {
      const created = await budgetItems.create(payload as Partial<BudgetItem>);
      clearVendorBudgetAutoCreateSuppression(vendor.wedding_id, vendor.id);
      if (options.debug) console.log('[vendor-budget-sync] item financeiro criado', created);
      return created;
    } catch (error) {
      const existingAfterConflict = await findBudgetItemByVendor(vendor.wedding_id, vendor.id);
      if (!existingAfterConflict) throw error;

      const updated = needsBudgetSync(existingAfterConflict, payload)
        ? await budgetItems.update(existingAfterConflict.id, payload as Partial<BudgetItem>)
        : existingAfterConflict;
      clearVendorBudgetAutoCreateSuppression(vendor.wedding_id, vendor.id);
      if (options.debug) console.log('[vendor-budget-sync] item financeiro atualizado', updated);
      return updated;
    }
  } catch (error) {
    if (options.debug) console.log('[vendor-budget-sync] erro do Supabase', error);
    throw error;
  }
}
