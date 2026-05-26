import { BudgetItem, Vendor } from '../types';
import { budgetCategories } from './constants';

export function getPaymentStatus(contractedValue: number, paidValue: number) {
  const contracted = Number(contractedValue ?? 0);
  const paid = Number(paidValue ?? 0);
  if (paid <= 0) return 'pendente';
  if (paid < contracted) return 'pago parcialmente';
  return 'pago';
}

export function getPendingValue(contractedValue: number, paidValue: number) {
  return Math.max(0, Number(contractedValue ?? 0) - Number(paidValue ?? 0));
}

export function isBudgetOverdue(item: Pick<BudgetItem, 'due_date' | 'payment_status' | 'contracted_value' | 'paid_value'>) {
  return Boolean(
    item.due_date &&
      getPendingValue(Number(item.contracted_value ?? 0), Number(item.paid_value ?? 0)) > 0 &&
      item.payment_status !== 'cancelado' &&
      new Date(`${item.due_date}T23:59:59`) < new Date()
  );
}

export function vendorToBudgetPayload(vendor: Vendor) {
  return {
    name: vendor.name,
    category: toPrimaryCategory(vendor.category),
    vendor_id: vendor.id,
    estimated_value: Number(vendor.contracted_value ?? 0),
    contracted_value: Number(vendor.contracted_value ?? 0),
    paid_value: Number(vendor.paid_value ?? 0),
    due_date: vendor.due_date,
    payment_status: getPaymentStatus(Number(vendor.contracted_value ?? 0), Number(vendor.paid_value ?? 0)),
    description: vendor.notes,
    notes: vendor.notes
  };
}

export function categoryToBudgetSlug(category: string) {
  const normalized = normalizeCategoryText(toPrimaryCategory(category));
  if (normalized.includes('espaco')) return 'espaco';
  if (normalized.includes('buffet')) return 'buffet';
  if (normalized.includes('bebida')) return 'bebidas';
  if (normalized.includes('decor')) return 'decoracao';
  if (normalized.includes('foto') || normalized.includes('film')) return 'foto-video';
  if (normalized.includes('roupa') || normalized.includes('vestido') || normalized.includes('terno')) return 'roupas';
  if (normalized.includes('doce') || normalized.includes('bolo')) return 'doces-bolo';
  if (normalized.includes('musica') || normalized.includes('dj')) return 'musica';
  if (normalized.includes('cerimonial')) return 'cerimonial';
  return 'outros';
}

export function normalizeCategoryText(category: string) {
  return category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function toPrimaryCategory(category?: string | null) {
  const normalized = normalizeCategoryText(category ?? '');
  const aliasMap: Record<string, string> = {
    fotografia: 'Foto e Vídeo',
    filmagem: 'Foto e Vídeo',
    musica: 'Música / DJ',
    dj: 'Música / DJ',
    doces: 'Doces e Bolo',
    bolo: 'Doces e Bolo',
    vestido: 'Roupas dos Noivos',
    terno: 'Roupas dos Noivos',
    maquiagem: 'Beleza da Noiva',
    cabelo: 'Beleza da Noiva'
  };

  if (aliasMap[normalized]) return aliasMap[normalized];
  return budgetCategories.find((item) => normalizeCategoryText(item) === normalized) ?? category ?? 'Outros';
}

export function isMainCategory(category?: string | null) {
  const primary = toPrimaryCategory(category);
  return budgetCategories.some((item) => item === primary);
}
