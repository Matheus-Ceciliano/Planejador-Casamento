export const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export function formatMoney(value?: number | null) {
  return brl.format(Number(value ?? 0));
}

export function formatPersonShortName(value?: string | null) {
  const parts = (value ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function formatFamilyDisplayName(responsibleName: string | null | undefined, fallback: string) {
  const shortName = formatPersonShortName(responsibleName);
  return shortName ? `Família ${shortName}` : fallback;
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));
}

export function daysUntil(value?: string | null) {
  if (!value) return 0;
  const today = new Date();
  const target = new Date(`${value}T12:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

export function parseMoney(value: string) {
  const normalized = value.replace(/\D/g, '');
  return Number(normalized || 0) / 100;
}

export function moneyInput(value: number | null | undefined) {
  return formatMoney(value).replace('R$', '').trim();
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}
