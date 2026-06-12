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
  risco: number;
  riscoLabel: 'Baixo' | 'Moderado' | 'Alto' | 'Muito alto' | 'Sem dados';
  label: string;
  motivo: string;
  detalhes: {
    orcamentoPlanejado: number;
    totalContratado: number;
    totalPago: number;
    totalPendente: number;
    valorAtrasado: number;
    valorVencendoEm7Dias: number;
    valorVencendoEm30Dias: number;
    valorSemDataLimite: number;
    fornecedoresSemDataLimite: number;
    percentualPago: number;
    percentualPendente: number;
    percentualAtrasado: number;
    percentualOrcamentoUsado: number;
    fornecedoresSemPagamento: number;
    diasAteProximoVencimento: number | null;
  };
};

type FinancialHealthInput = {
  orcamentoPlanejado?: number;
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskContribution(base: number, ratio: number, multiplier: number, cap: number) {
  if (ratio <= 0) return 0;
  return Math.min(cap, base + ratio * multiplier);
}

function labelForFinancialHealth(score: number) {
  if (score >= 80) return { status: 'saudavel' as const, label: 'Saudável' };
  if (score >= 60) return { status: 'atencao' as const, label: 'Atenção' };
  if (score >= 40) return { status: 'preocupante' as const, label: 'Preocupante' };
  return { status: 'critica' as const, label: 'Crítico' };
}

function labelForRisk(risk: number): FinancialHealthResult['riscoLabel'] {
  if (risk <= 20) return 'Baixo';
  if (risk <= 40) return 'Moderado';
  if (risk <= 60) return 'Alto';
  return 'Muito alto';
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
  orcamentoPlanejado,
  totalContratado,
  totalPago,
  itensFinanceiros = [],
  pagamentos = [],
  fornecedores = [],
  hoje = new Date()
}: FinancialHealthInput): FinancialHealthResult {
  const orcamentoPlanejadoReal = Math.max(0, Number(orcamentoPlanejado ?? 0));
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
  const percentualOrcamentoUsado = percentOf(totalContratadoReal, orcamentoPlanejadoReal);

  if (totalContratadoReal <= 0) {
    return {
      status: 'sem_dados',
      score: 0,
      risco: 0,
      riscoLabel: 'Sem dados',
      label: 'Sem dados',
      motivo: 'Cadastre valores contratados para calcular a saúde financeira.',
      detalhes: {
        orcamentoPlanejado: orcamentoPlanejadoReal,
        totalContratado: 0,
        totalPago: 0,
        totalPendente: 0,
        valorAtrasado: 0,
        valorVencendoEm7Dias: 0,
        valorVencendoEm30Dias: 0,
        valorSemDataLimite: 0,
        fornecedoresSemDataLimite: 0,
        percentualPago: 0,
        percentualPendente: 0,
        percentualAtrasado: 0,
        percentualOrcamentoUsado: 0,
        fornecedoresSemPagamento: 0,
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
  const upcoming8to30 = dues.filter((due) => {
    if (!due.dueDate) return false;
    const days = daysBetween(hoje, dateAtNoon(due.dueDate));
    return days > 7 && days <= 30;
  });

  const valorAtrasado = overdueDues.reduce((sum, due) => sum + due.amount, 0);
  const valorVencendoEm7Dias = upcoming7.reduce((sum, due) => sum + due.amount, 0);
  const valorVencendo8a30 = upcoming8to30.reduce((sum, due) => sum + due.amount, 0);
  const valorVencendoEm30Dias = valorVencendoEm7Dias + valorVencendo8a30;
  const fornecedoresSemData = fornecedores.filter((vendor) => {
    const pending = getPendingValue(vendor.contracted_value, vendor.paid_value);
    return isContractedVendor(vendor) && pending > 0 && !vendor.due_date;
  });
  const valorSemDataLimite = fornecedoresSemData.reduce(
    (sum, vendor) => sum + getPendingValue(vendor.contracted_value, vendor.paid_value),
    0
  );
  const fornecedoresSemPagamento = fornecedores.filter(
    (vendor) =>
      isContractedVendor(vendor) &&
      Number(vendor.contracted_value ?? 0) > 0 &&
      Number(vendor.paid_value ?? 0) <= 0
  );

  const percentualAtrasado = percentOf(valorAtrasado, totalContratadoReal);
  const percentualVencendo7 = percentOf(valorVencendoEm7Dias, totalContratadoReal);
  const percentualVencendo8a30 = percentOf(valorVencendo8a30, totalContratadoReal);
  const percentualSemDataLimite = percentOf(valorSemDataLimite, totalContratadoReal);
  const proximoVencimento = datedDues
    .map((due) => daysBetween(hoje, dateAtNoon(due.dueDate as string)))
    .filter((days) => days >= 0)
    .sort((a, b) => a - b)[0] ?? null;

  let risk = 0;

  // Saldo pendente distante e pagamentos futuros normais nao devem derrubar a saude.
  risk += Math.min(5, percentualPendente * 5);
  risk += riskContribution(38, percentualAtrasado, 75, 68);
  risk += riskContribution(14, percentualVencendo7, 45, 32);
  risk += riskContribution(7, percentualVencendo8a30, 28, 20);
  risk += riskContribution(4, percentualSemDataLimite, 12, 12);
  risk += Math.min(5, fornecedoresSemData.length);
  risk += Math.min(5, fornecedoresSemPagamento.length);

  if (orcamentoPlanejadoReal > 0) {
    if (percentualOrcamentoUsado > 1) {
      risk += Math.min(30, 15 + (percentualOrcamentoUsado - 1) * 50);
    } else if (percentualOrcamentoUsado > 0.9) {
      risk += 5 + (percentualOrcamentoUsado - 0.9) * 50;
    }
  }

  const risco = clampScore(risk);
  const score = clampScore(100 - risco);
  const classification = labelForFinancialHealth(score);
  const riscoLabel = labelForRisk(risco);

  let motivo = 'Não há valores pendentes relevantes.';
  if (valorAtrasado > 0) {
    motivo = `Há ${formatMoney(valorAtrasado)} em pagamentos atrasados.`;
  } else if (valorVencendoEm7Dias > 0) {
    motivo = `Há ${formatMoney(valorVencendoEm7Dias)} vencendo nos próximos 7 dias.`;
  } else if (orcamentoPlanejadoReal > 0 && percentualOrcamentoUsado > 1) {
    motivo = `O valor contratado ultrapassa o orçamento planejado em ${formatMoney(totalContratadoReal - orcamentoPlanejadoReal)}.`;
  } else if (valorVencendoEm30Dias > 0) {
    motivo = `Há ${formatMoney(valorVencendoEm30Dias)} vencendo nos próximos 30 dias.`;
  } else if (fornecedoresSemData.length > 0) {
    motivo = `${fornecedoresSemData.length} fornecedor${fornecedoresSemData.length > 1 ? 'es' : ''} com valor pendente sem data limite de pagamento.`;
  } else if (totalPendente > 0) {
    motivo = `Há ${formatMoney(totalPendente)} pendentes, mas sem pagamentos atrasados ou vencimentos críticos no curto prazo.`;
  }

  return {
    ...classification,
    score,
    risco,
    riscoLabel,
    motivo,
    detalhes: {
      orcamentoPlanejado: orcamentoPlanejadoReal,
      totalContratado: totalContratadoReal,
      totalPago: totalPagoReal,
      totalPendente,
      valorAtrasado,
      valorVencendoEm7Dias,
      valorVencendoEm30Dias,
      valorSemDataLimite,
      fornecedoresSemDataLimite: fornecedoresSemData.length,
      percentualPago,
      percentualPendente,
      percentualAtrasado,
      percentualOrcamentoUsado,
      fornecedoresSemPagamento: fornecedoresSemPagamento.length,
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
    fotografia: 'Foto e Video',
    filmagem: 'Foto e Video',
    musica: 'Musica / DJ',
    dj: 'Musica / DJ',
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
