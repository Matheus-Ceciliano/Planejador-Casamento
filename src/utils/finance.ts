import { BudgetItem, PaymentInstallment, Vendor } from '../types';
import { budgetCategories } from './constants';
import { formatMoney } from './format';

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

function normalizeStatus(status?: string | null) {
  return String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function pendingInstallmentValue(installment: Pick<PaymentInstallment, 'amount' | 'paid_amount'>) {
  return Math.max(0, Number(installment.amount ?? 0) - Number(installment.paid_amount ?? 0));
}

export function isBudgetOverdue(item: Pick<BudgetItem, 'due_date' | 'payment_status' | 'contracted_value' | 'paid_value'>) {
  return Boolean(
    item.due_date &&
      getPendingValue(Number(item.contracted_value ?? 0), Number(item.paid_value ?? 0)) > 0 &&
      normalizeStatus(item.payment_status) !== 'cancelado' &&
      new Date(`${item.due_date}T23:59:59`) < new Date()
  );
}

export function isPaymentInstallmentOverdue(installment: PaymentInstallment) {
  const status = normalizeStatus(installment.status);
  return Boolean(
    pendingInstallmentValue(installment) > 0 &&
      !['pago', 'cancelado'].includes(status) &&
      (status === 'vencido' || (installment.due_date && new Date(`${installment.due_date}T23:59:59`) < new Date()))
  );
}

type FinancialDue = {
  amount: number;
  dueDate: string | null;
  status: string;
};

export type FinancialHealthStatus = 'saudavel' | 'atencao' | 'preocupante' | 'critica' | 'sem_dados';

export type FinancialHealthResult = {
  status: FinancialHealthStatus;
  score: number;
  label: string;
  motivo: string;
  detalhes: {
    totalContratado: number;
    totalPago: number;
    totalPendente: number;
    valorAtrasado: number;
    valorVencendoEm7Dias: number;
    valorVencendoEm30Dias: number;
    percentualPago: number;
    percentualPendente: number;
    percentualAtrasado: number;
    diasAteProximoVencimento: number | null;
  };
};

type FinancialHealthInput = {
  totalContratado?: number;
  totalPago?: number;
  itensFinanceiros?: BudgetItem[];
  pagamentos?: PaymentInstallment[];
  fornecedores?: Vendor[];
  dataCasamento?: string | null;
  hoje?: Date;
};

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

function daysBetween(from: Date, to: Date) {
  const day = 24 * 60 * 60 * 1000;
  const left = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const right = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.ceil((right - left) / day);
}

function percentOf(value: number, total: number) {
  if (!total) return 0;
  return value / total;
}

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function labelForFinancialRisk(score: number) {
  if (score <= 20) return { status: 'saudavel' as const, label: 'Saudável' };
  if (score <= 45) return { status: 'atencao' as const, label: 'Atenção' };
  if (score <= 70) return { status: 'preocupante' as const, label: 'Preocupante' };
  return { status: 'critica' as const, label: 'Crítica' };
}

function buildFinancialDueList(items: BudgetItem[], installments: PaymentInstallment[]) {
  const installmentItemIds = new Set(installments.map((item) => item.budget_item_id).filter(Boolean));
  const installmentDues: FinancialDue[] = installments
    .filter((installment) => !['pago', 'cancelado'].includes(normalizeStatus(installment.status)))
    .map((installment) => ({
      amount: pendingInstallmentValue(installment),
      dueDate: installment.due_date,
      status: normalizeStatus(installment.status)
    }))
    .filter((due) => due.amount > 0);

  const itemDues: FinancialDue[] = items
    .filter((item) => !installmentItemIds.has(item.id))
    .filter((item) => normalizeStatus(item.payment_status) !== 'cancelado')
    .map((item) => ({
      amount: getPendingValue(item.contracted_value, item.paid_value),
      dueDate: item.due_date,
      status: normalizeStatus(item.payment_status)
    }))
    .filter((due) => due.amount > 0);

  return [...installmentDues, ...itemDues];
}

export function calculateFinancialHealth({
  totalContratado,
  totalPago,
  itensFinanceiros = [],
  pagamentos = [],
  dataCasamento,
  hoje = new Date()
}: FinancialHealthInput): FinancialHealthResult {
  const totalContratadoReal = Math.max(
    0,
    Number(totalContratado ?? itensFinanceiros.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0))
  );
  const totalPagoReal = Math.min(
    totalContratadoReal,
    Math.max(0, Number(totalPago ?? itensFinanceiros.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0)))
  );
  const totalPendente = Math.max(0, totalContratadoReal - totalPagoReal);
  const percentualPago = percentOf(totalPagoReal, totalContratadoReal);
  const percentualPendente = percentOf(totalPendente, totalContratadoReal);

  if (totalContratadoReal <= 0) {
    return {
      status: 'sem_dados',
      score: 0,
      label: 'Sem dados financeiros suficientes',
      motivo: 'Cadastre valores contratados para calcular a saúde financeira.',
      detalhes: {
        totalContratado: 0,
        totalPago: 0,
        totalPendente: 0,
        valorAtrasado: 0,
        valorVencendoEm7Dias: 0,
        valorVencendoEm30Dias: 0,
        percentualPago: 0,
        percentualPendente: 0,
        percentualAtrasado: 0,
        diasAteProximoVencimento: null
      }
    };
  }

  const dues = buildFinancialDueList(itensFinanceiros, pagamentos);
  const datedDues = dues.filter((due) => due.dueDate);
  const overdueDues = dues.filter((due) => {
    if (due.status === 'vencido') return true;
    return Boolean(due.dueDate && daysBetween(hoje, dateAtNoon(due.dueDate)) < 0);
  });
  const upcoming7 = dues.filter((due) => {
    if (!due.dueDate) return false;
    const days = daysBetween(hoje, dateAtNoon(due.dueDate));
    return days >= 0 && days <= 7;
  });
  const upcoming30 = dues.filter((due) => {
    if (!due.dueDate) return false;
    const days = daysBetween(hoje, dateAtNoon(due.dueDate));
    return days >= 0 && days <= 30;
  });
  const upcoming8to30 = dues.filter((due) => {
    if (!due.dueDate) return false;
    const days = daysBetween(hoje, dateAtNoon(due.dueDate));
    return days > 7 && days <= 30;
  });

  const valorAtrasado = overdueDues.reduce((sum, due) => sum + due.amount, 0);
  const valorVencendoEm7Dias = upcoming7.reduce((sum, due) => sum + due.amount, 0);
  const valorVencendoEm30Dias = upcoming30.reduce((sum, due) => sum + due.amount, 0);
  const percentualAtrasado = percentOf(valorAtrasado, totalContratadoReal);
  const proximoVencimento = datedDues
    .map((due) => daysBetween(hoje, dateAtNoon(due.dueDate as string)))
    .filter((days) => days >= 0)
    .sort((a, b) => a - b)[0] ?? null;
  const diasAteCasamento = dataCasamento ? daysBetween(hoje, dateAtNoon(dataCasamento)) : null;

  let risk = 0;

  if (valorAtrasado > 0) {
    if (percentualAtrasado < 0.02) risk += 10;
    else if (percentualAtrasado <= 0.10) risk += 25;
    else risk += 40;
  }

  const pct7 = percentOf(valorVencendoEm7Dias, totalContratadoReal);
  const valorVencendo8a30 = upcoming8to30.reduce((sum, due) => sum + due.amount, 0);
  const pct8to30 = percentOf(valorVencendo8a30, totalContratadoReal);

  if (valorVencendoEm7Dias > 0) risk += pct7 > 0.05 ? 20 : 8;
  if (valorVencendo8a30 > 0) risk += pct8to30 > 0.10 ? 15 : 5;

  if (diasAteCasamento !== null) {
    if (diasAteCasamento < 30) {
      if (percentualPago < 0.5) risk += 35;
      else if (percentualPago < 0.7) risk += 22;
      if (percentualPendente > 0.4) risk += 25;
      else if (percentualPendente > 0.2) risk += 12;
    } else if (diasAteCasamento < 90) {
      if (percentualPago < 0.5) risk += 25;
      else if (percentualPago < 0.7) risk += 15;
      if (percentualPendente > 0.5) risk += 15;
    } else if (diasAteCasamento <= 180) {
      if (percentualPago < 0.5) risk += 10;
      if (percentualPendente > 0.6) risk += 8;
    }
  }

  if (diasAteCasamento !== null && diasAteCasamento > 180 && valorAtrasado === 0) {
    risk = Math.min(risk, 35);
  }

  if (percentualPendente < 0.01) {
    risk = Math.min(risk, 45);
  }

  if (totalPendente > 0 && valorAtrasado === 0 && valorVencendoEm30Dias === 0) {
    risk = Math.min(risk, diasAteCasamento !== null && diasAteCasamento < 30 && percentualPendente > 0.4 ? risk : 20);
  }

  const score = clampRisk(risk);
  const classification = labelForFinancialRisk(score);

  let motivo = 'Não há valores atrasados e os próximos vencimentos ainda estão distantes.';
  if (valorAtrasado > 0) {
    motivo = `Há ${formatMoney(valorAtrasado)} em pagamentos atrasados.`;
  } else if (valorVencendoEm7Dias > 0) {
    motivo = `Há ${formatMoney(valorVencendoEm7Dias)} vencendo nos próximos 7 dias.`;
  } else if (valorVencendoEm30Dias > 0) {
    motivo = `Há ${formatMoney(valorVencendoEm30Dias)} vencendo nos próximos 30 dias.`;
  } else if (diasAteCasamento !== null && diasAteCasamento < 30 && percentualPendente > 0.4) {
    motivo = `O casamento está próximo e ${Math.round(percentualPendente * 100)}% do valor contratado ainda está pendente.`;
  } else if (totalPendente > 0) {
    motivo = `Há ${formatMoney(totalPendente)} pendentes, mas sem vencimentos críticos no curto prazo.`;
  }

  return {
    ...classification,
    score,
    motivo,
    detalhes: {
      totalContratado: totalContratadoReal,
      totalPago: totalPagoReal,
      totalPendente,
      valorAtrasado,
      valorVencendoEm7Dias,
      valorVencendoEm30Dias,
      percentualPago,
      percentualPendente,
      percentualAtrasado,
      diasAteProximoVencimento: proximoVencimento
    }
  };
}

export function normalizeVendorStatus(status?: string | null) {
  return String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function isContractedVendor(vendor: Pick<Vendor, 'status'>) {
  return normalizeVendorStatus(vendor.status) === 'contratado';
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
