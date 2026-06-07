import { BudgetItem, Vendor } from '../types';
import { vendorToBudgetPayload } from './finance';

type BudgetTableApi = {
  create: (payload: Partial<BudgetItem>) => Promise<BudgetItem>;
  update: (id: string, payload: Partial<BudgetItem>) => Promise<BudgetItem>;
};

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
  options: { debug?: boolean } = {}
) {
  const payload = vendorToBudgetPayload(vendor);
  const existing = existingItems.find((item) => item.vendor_id === vendor.id);

  if (options.debug) console.log('[vendor-budget-sync] fornecedor encontrado', vendor);

  try {
    if (existing) {
      if (needsBudgetSync(existing, payload)) {
        const updated = await budgetItems.update(existing.id, payload as Partial<BudgetItem>);
        if (options.debug) console.log('[vendor-budget-sync] item financeiro atualizado', updated);
        return updated;
      }

      if (options.debug) console.log('[vendor-budget-sync] item financeiro já sincronizado', existing);
      return existing;
    }

    const created = await budgetItems.create(payload as Partial<BudgetItem>);
    if (options.debug) console.log('[vendor-budget-sync] item financeiro criado', created);
    return created;
  } catch (error) {
    if (options.debug) console.log('[vendor-budget-sync] erro do Supabase', error);
    throw error;
  }
}
