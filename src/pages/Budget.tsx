import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Search,
  Wallet,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetCategory, BudgetItem, PaymentRecord, Vendor } from '../types';
import { budgetCategories, categorySlugMap } from '../utils/constants';
import { getPaymentStatus, getPendingValue, isBudgetOverdue, isContractedVendor, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';
import { clearVendorBudgetAutoCreateSuppression, syncVendorBudgetItem } from '../utils/vendorBudgetSync';

const preferredTabs = ['Todos', 'Buffet', 'Decoração', 'Foto e Vídeo', 'Música / DJ', 'Cerimonial', 'Espaço', 'Bebidas', 'Outros'];
const paymentStatuses = ['pendente', 'pago parcialmente', 'pago', 'vencido', 'cancelado'];
const blank = {
  name: '',
  category: 'Buffet',
  description: '',
  estimated_value: 0,
  contracted_value: 0,
  paid_value: 0,
  payment_status: 'pendente',
  due_date: '',
  payment_date: '',
  payment_method: '',
  vendor_id: '',
  receipt_url: '',
  notes: ''
};

const paymentBlank = {
  amount: 0,
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: '',
  receipt_url: '',
  notes: ''
};

const paymentMethodOptions = ['Pix', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência', 'Outro'];
const paymentHistoryPrefix = '[PAGAMENTO] ';

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function paymentStatusLabel(contractedValue: number, paidValue: number) {
  const pending = getPendingValue(contractedValue, paidValue);
  if (pending <= 0 && Number(contractedValue ?? 0) > 0) return 'Pago';
  if (Number(paidValue ?? 0) > 0) return 'Parcial';
  return 'Pendente';
}

function receiptFileName(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'Comprovante anexado');
  } catch {
    return decodeURIComponent(url.split('/').pop() || 'Comprovante anexado');
  }
}

function buildPaymentHistoryEntry(amount: number, date: string, method: string, receiptUrl?: string, note?: string) {
  const parts = [
    formatMoney(amount),
    date ? formatDate(date) : 'sem data',
    method || 'sem forma',
    receiptUrl ? `comprovante: ${receiptUrl}` : '',
    note ? `obs: ${note}` : ''
  ].filter(Boolean);
  return `${paymentHistoryPrefix}${parts.join(' | ')}`;
}

function paymentHistory(notes?: string | null) {
  return String(notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(paymentHistoryPrefix))
    .map((line) => line.slice(paymentHistoryPrefix.length));
}

function paymentRecordStatusLabel(status: string) {
  return status === 'canceled' ? 'Cancelado' : 'Confirmado';
}

function paymentRecordTone(status: string) {
  return status === 'canceled' ? 'badge-red' : 'badge-green';
}

function nextApNumber(records: PaymentRecord[]) {
  const next = records.reduce((max, record) => {
    const match = record.ap_number?.match(/^AP-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `AP-${String(next).padStart(4, '0')}`;
}

function dueBucket(item: BudgetItem) {
  if (!item.due_date || getPendingValue(item.contracted_value, item.paid_value) <= 0) return '';
  const today = new Date();
  const due = new Date(`${item.due_date}T12:00:00`);
  const start = new Date(today.toISOString().slice(0, 10));
  const inSeven = new Date(start);
  inSeven.setDate(start.getDate() + 7);
  if (isBudgetOverdue(item)) return 'overdue';
  if (due.toISOString().slice(0, 10) === start.toISOString().slice(0, 10)) return 'today';
  if (due <= inSeven) return 'next7';
  return '';
}

function CategorySelect({
  value,
  options,
  onChange,
  onCreate
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function submit() {
    const next = toPrimaryCategory(name.trim());
    if (!next) return;
    await onCreate(next);
    onChange(next);
    setCreating(false);
    setName('');
  }

  return (
    <div className="space-y-2">
      <FormSelect label="Categoria" value={value} onChange={(event) => onChange(event.target.value)} options={options.map((item) => ({ label: item, value: item }))} />
      {!creating ? (
        <button type="button" className="text-xs font-semibold text-w-rose hover:underline" onClick={() => setCreating(true)}>
          + Nova categoria
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <FormInput label="Nova categoria" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="button" className="btn-primary self-end" onClick={submit}>Criar</button>
          <button type="button" className="btn-secondary self-end px-3" onClick={() => setCreating(false)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  helper,
  tone,
  icon: Icon,
  accent = 'border-w-border bg-white',
  iconTone = 'bg-white text-w-muted ring-w-border',
  bar = 'bg-w-border'
}: {
  label: string;
  value: string;
  helper: string;
  tone: string;
  icon: typeof Wallet;
  accent?: string;
  iconTone?: string;
  bar?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ${accent}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-w-faint">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${iconTone}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className={`mt-1.5 truncate text-[22px] font-bold leading-7 ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-w-muted">{helper}</p>
    </div>
  );
}

function BudgetProgress({ committed, planned, pct }: { committed: number; planned: number; pct: number }) {
  return (
    <section className="card-hover-soft rounded-3xl border border-[#E5E7EB] bg-white p-3.5 shadow-soft sm:p-4">
      <div className="mb-2.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-w-text">Orçamento utilizado</h2>
          <p className="mt-1 text-sm text-w-muted">{formatMoney(committed)} de {formatMoney(planned)}</p>
        </div>
        <p className="text-sm font-bold text-w-rose">{pct}% comprometido</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div className="h-full rounded-full bg-[#E11D48] transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

export default function Budget() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();
  const { wedding } = useWedding();
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const categories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const paymentRecords = useWeddingTable<PaymentRecord>('payment_history', 'created_at');
  const initial = params.category ? categorySlugMap[params.category] ?? 'Outros' : 'Todos';
  const [active, setActive] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [detailItem, setDetailItem] = useState<BudgetItem | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [paying, setPaying] = useState<BudgetItem | null>(null);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [form, setForm] = useState({ ...blank, category: initial === 'Todos' ? 'Buffet' : initial });
  const [paymentForm, setPaymentForm] = useState(paymentBlank);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [message, setMessage] = useState('');
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState<PaymentRecord | null>(null);
  const [cancelingPaymentRecord, setCancelingPaymentRecord] = useState<PaymentRecord | null>(null);
  const syncInFlight = useRef(new Set<string>());

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor])), [vendors.rows]);
  const itemById = useMemo(() => new Map(items.rows.map((item) => [item.id, item])), [items.rows]);
  const selectedDetailItem = detailItem ? items.rows.find((item) => item.id === detailItem.id) ?? detailItem : null;
  const selectedDetailVendor = selectedDetailItem?.vendor_id ? vendorById.get(selectedDetailItem.vendor_id) : undefined;

  useEffect(() => {
    setDetailNotes(selectedDetailItem?.notes ?? '');
  }, [selectedDetailItem?.id, selectedDetailItem?.notes]);
  const budgetItemsByVendorId = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    items.rows.forEach((item) => {
      if (!item.vendor_id) return;
      map.set(item.vendor_id, [...(map.get(item.vendor_id) ?? []), item]);
    });
    return map;
  }, [items.rows]);

  useEffect(() => {
    items.rows
      .filter((item) => item.category !== toPrimaryCategory(item.category))
      .forEach((item) => items.update(item.id, { category: toPrimaryCategory(item.category) } as Partial<BudgetItem>).catch(console.error));
  }, [items.rows]);

  useEffect(() => {
    vendors.rows.filter(isContractedVendor).forEach((vendor) => {
      if (syncInFlight.current.has(vendor.id)) return;
      syncInFlight.current.add(vendor.id);
      syncVendorBudgetItem(vendor, budgetItemsByVendorId.get(vendor.id) ?? [], items, { debug: true })
        .catch((error) => console.log('[vendor-budget-sync] erro do Supabase', error))
        .finally(() => syncInFlight.current.delete(vendor.id));
    });
  }, [vendors.rows]);

  const categoryOptions = useMemo(() => {
    const custom = categories.rows.map((item) => toPrimaryCategory(item.name)).filter(Boolean);
    const withData = items.rows.map((item) => toPrimaryCategory(item.category)).filter(Boolean);
    return Array.from(new Set([...preferredTabs.filter((item) => item !== 'Todos'), ...budgetCategories, ...custom, ...withData]));
  }, [categories.rows, items.rows]);

  const tabs = useMemo(() => Array.from(new Set([...preferredTabs, ...categoryOptions])), [categoryOptions]);

  const totals = useMemo(() => {
    const planned = Number(wedding?.planned_budget ?? 0);
    const committed = items.rows.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0);
    const paid = items.rows.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0);
    const remaining = Math.max(0, planned - committed);
    const pending = Math.max(0, committed - paid);
    return {
      planned,
      committed,
      paid,
      remaining,
      pending,
      committedPct: percent(committed, planned),
      paidPct: percent(paid, planned)
    };
  }, [items.rows, wedding?.planned_budget]);

  const rows = useMemo(() => {
    const now = new Date();
    const inSeven = new Date(now);
    inSeven.setDate(now.getDate() + 7);
    const inThirty = new Date(now);
    inThirty.setDate(now.getDate() + 30);

    return items.rows.filter((item) => {
      const due = item.due_date ? new Date(`${item.due_date}T12:00:00`) : null;
      const vendor = vendorById.get(item.vendor_id ?? '');
      const haystack = `${item.name} ${item.category} ${vendor?.name ?? ''} ${item.notes ?? ''}`.toLowerCase();
      const dueMatch =
        !dueFilter ||
        (dueFilter === 'today' && dueBucket(item) === 'today') ||
        (dueFilter === 'overdue' && isBudgetOverdue(item)) ||
        (dueFilter === 'next7' && due && due >= now && due <= inSeven) ||
        (dueFilter === 'next30' && due && due >= now && due <= inThirty) ||
        (dueFilter === 'no_due' && !due);
      return (
        (active === 'Todos' || toPrimaryCategory(item.category) === active) &&
        haystack.includes(search.toLowerCase()) &&
        (!status || (status === 'vencido' ? isBudgetOverdue(item) : item.payment_status === status)) &&
        dueMatch
      );
    });
  }, [active, dueFilter, items.rows, search, status, vendorById]);

  const upcomingDue = useMemo(
    () =>
      items.rows
        .filter((item) => item.due_date && getPendingValue(item.contracted_value, item.paid_value) > 0)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .slice(0, 3),
    [items.rows]
  );

  const activeFilterCount = [search.trim(), status, dueFilter].filter(Boolean).length;

  async function createCategory(name: string) {
    if (categoryOptions.includes(name)) return;
    await categories.create({ name, sort_order: categories.rows.length + 1 } as Partial<BudgetCategory>);
  }

  function start(row?: BudgetItem) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            name: row.name,
            category: toPrimaryCategory(row.category),
            description: row.description ?? '',
            estimated_value: row.estimated_value,
            contracted_value: row.contracted_value,
            paid_value: row.paid_value,
            payment_status: row.payment_status,
            due_date: row.due_date ?? '',
            payment_date: row.payment_date ?? '',
            payment_method: row.payment_method ?? '',
            vendor_id: row.vendor_id ?? '',
            receipt_url: row.receipt_url ?? '',
            notes: row.notes ?? ''
          }
        : { ...blank, category: active === 'Todos' ? 'Buffet' : active }
    );
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      category: toPrimaryCategory(form.category),
      vendor_id: form.vendor_id || null,
      due_date: form.due_date || null,
      payment_date: form.payment_date || null,
      receipt_url: form.receipt_url || null,
      payment_status: getPaymentStatus(form.contracted_value, form.paid_value)
    };
    const existingVendorItem = form.vendor_id
      ? items.rows.find((item) => item.wedding_id === wedding?.id && item.vendor_id === form.vendor_id && item.id !== editing?.id)
      : null;

    if (existingVendorItem) {
      if (editing) {
        setMessage('Já existe um item financeiro para este fornecedor. Edite o fornecedor na aba Fornecedores.');
        return;
      }

      const saved = await items.update(existingVendorItem.id, payload as Partial<BudgetItem>);
      if (saved.vendor_id) clearVendorBudgetAutoCreateSuppression(saved.wedding_id, saved.vendor_id);
      setOpen(false);
      return;
    }

    const saved = editing ? await items.update(editing.id, payload as Partial<BudgetItem>) : await items.create(payload as Partial<BudgetItem>);
    if (saved.vendor_id) clearVendorBudgetAutoCreateSuppression(saved.wedding_id, saved.vendor_id);
    setOpen(false);
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!paying) return;

    const paymentAmount = Number(paymentForm.amount ?? 0);
    const remaining = getPendingValue(paying.contracted_value, paying.paid_value);

    if (paymentAmount <= 0 || paymentAmount > remaining || !paymentForm.payment_date || !paymentForm.payment_method) return;

    setPaymentConfirmOpen(true);
  }

  async function confirmPayment() {
    if (!paying || paymentSubmitting) return;

    const currentPaid = Number(paying.paid_value ?? 0);
    const paymentAmount = Number(paymentForm.amount ?? 0);
    const remaining = getPendingValue(paying.contracted_value, paying.paid_value);

    if (remaining <= 0) {
      setMessage('Este pagamento já foi confirmado.');
      setPaymentConfirmOpen(false);
      return;
    }

    if (paymentAmount <= 0 || paymentAmount > remaining || !paymentForm.payment_date || !paymentForm.payment_method) {
      setPaymentConfirmOpen(false);
      return;
    }

    setPaymentSubmitting(true);
    const nextPaid = currentPaid + paymentAmount;
    const historyEntry = buildPaymentHistoryEntry(
      paymentAmount,
      paymentForm.payment_date,
      paymentForm.payment_method,
      paymentForm.receipt_url,
      paymentForm.notes
    );
    try {
      const paymentRecord = await paymentRecords.create({
        ap_number: nextApNumber(paymentRecords.rows),
        vendor_id: paying.vendor_id,
        budget_item_id: paying.id,
        payment_id: null,
        amount: paymentAmount,
        payment_method: paymentForm.payment_method || null,
        payment_date: paymentForm.payment_date || null,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user?.id ?? null,
        notes: paymentForm.notes || null,
        receipt_file_url: paymentForm.receipt_url || paying.receipt_url || null,
        status: 'confirmed',
        canceled_at: null,
        canceled_by: null,
        cancel_reason: null
      } as Partial<PaymentRecord>);

      await items.update(paying.id, {
        paid_value: nextPaid,
        payment_status: getPaymentStatus(paying.contracted_value, nextPaid),
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method || paying.payment_method,
        receipt_url: paymentForm.receipt_url || paying.receipt_url,
        notes: [paying.notes, historyEntry].filter(Boolean).join('\n')
      } as Partial<BudgetItem>);
      if (paying.vendor_id) {
        await vendors.update(paying.vendor_id, { paid_value: nextPaid, due_date: paying.due_date } as Partial<Vendor>);
      }
      setMessage(`Pagamento confirmado com sucesso. AP gerada: ${paymentRecord.ap_number}`);
      setPaymentConfirmOpen(false);
      setPaying(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
      if (message.includes("Could not find the table 'public.payment_history'")) {
        setMessage('A tabela payment_history ainda não existe no Supabase. Aplique o SQL supabase/payment-history.sql e tente confirmar novamente.');
        setPaymentConfirmOpen(false);
        return;
      }
      throw error;
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function cancelPaymentRecord() {
    if (!cancelingPaymentRecord || paymentSubmitting || cancelingPaymentRecord.status !== 'confirmed') return;

    const item = cancelingPaymentRecord.budget_item_id ? itemById.get(cancelingPaymentRecord.budget_item_id) : undefined;
    if (!item) {
      setMessage('Não foi possível localizar o item financeiro desta AP.');
      setCancelingPaymentRecord(null);
      return;
    }

    setPaymentSubmitting(true);
    try {
      const amount = Number(cancelingPaymentRecord.amount ?? 0);
      const nextPaid = Math.max(0, Number(item.paid_value ?? 0) - amount);
      await items.update(item.id, {
        paid_value: nextPaid,
        payment_status: getPaymentStatus(item.contracted_value, nextPaid)
      } as Partial<BudgetItem>);

      if (item.vendor_id) {
        const vendor = vendorById.get(item.vendor_id);
        await vendors.update(item.vendor_id, {
          paid_value: Math.max(0, Number(vendor?.paid_value ?? 0) - amount),
          due_date: item.due_date
        } as Partial<Vendor>);
      }

      await paymentRecords.update(cancelingPaymentRecord.id, {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        canceled_by: user?.id ?? null
      } as Partial<PaymentRecord>);
      setMessage('Pagamento cancelado. O saldo foi recalculado.');
      setCancelingPaymentRecord(null);
      setSelectedPaymentRecord(null);
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function startPayment(item: BudgetItem) {
    setPaying(item);
    setPaymentConfirmOpen(false);
    setPaymentForm({
      ...paymentBlank,
      amount: getPendingValue(item.contracted_value, item.paid_value),
      payment_method: item.payment_method ?? ''
    });
  }

  return (
    <div className="space-y-4 text-w-text">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-w-faint">Central financeira</p>
          <h1 className="page-title mt-1">Orçamento</h1>
          <p className="mt-1 text-sm text-w-muted">Contratos, comprovantes e vencimentos em uma única visão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigate('/fornecedores')}><ExternalLink size={16} /> Fornecedores</button>
          <button className="btn-primary" onClick={() => start()}><Plus size={16} /> Gasto</button>
          <button className="btn-secondary" onClick={() => navigate('/orcamento/analise')}><BarChart3 size={16} /> Ver análise financeira</button>
        </div>
      </div>

      {message && <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]">{message}</div>}
      <section className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orçamento total" value={formatMoney(totals.planned)} helper="Planejado" tone="text-[#2563EB]" icon={Wallet} accent="border-blue-100 bg-blue-50/50" iconTone="bg-white text-[#2563EB] ring-blue-100" bar="bg-[#2563EB]" />
        <Kpi label="Comprometido" value={formatMoney(totals.committed)} helper={`${totals.committedPct}% do total`} tone="text-w-rose" icon={CreditCard} accent="border-rose-100 bg-rose-50/50" iconTone="bg-white text-w-rose ring-rose-100" bar="bg-w-rose" />
        <Kpi label="Pago" value={formatMoney(totals.paid)} helper={`${totals.paidPct}% pago`} tone="text-[#15803D]" icon={DollarSign} accent="border-emerald-100 bg-emerald-50/50" iconTone="bg-white text-[#16A34A] ring-emerald-100" bar="bg-[#16A34A]" />
        <Kpi label="Em aberto" value={formatMoney(totals.pending)} helper="A pagar" tone="text-[#B45309]" icon={CalendarClock} accent="border-amber-100 bg-amber-50/55" iconTone="bg-white text-[#D97706] ring-amber-100" bar="bg-[#F59E0B]" />
      </section>

      <BudgetProgress committed={totals.committed} planned={totals.planned} pct={totals.committedPct} />

      <section className="card-hover-soft rounded-3xl border border-[#E5E7EB] bg-white p-3.5 shadow-soft sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-w-text">Proximos vencimentos</h2>
          <button type="button" className="btn-ghost" onClick={() => navigate('/orcamento/vencimentos')}>Ver todos</button>
        </div>
        <div className="mt-3 grid gap-2">
          {upcomingDue.length ? upcomingDue.map((item) => (
            <button key={item.id} type="button" className="card-hover-soft grid gap-2 rounded-2xl border border-[#E5E7EB] p-3 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center" onClick={() => setDueFilter('next30')}>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-w-text">{item.name}</p>
                <p className="text-xs font-semibold text-w-muted">{toPrimaryCategory(item.category)}</p>
              </div>
              <p className="text-sm font-semibold text-w-muted">{formatDate(item.due_date)}</p>
              <p className="text-sm font-bold text-[#F59E0B]">{formatMoney(getPendingValue(item.contracted_value, item.paid_value))}</p>
            </button>
          )) : (
            <p className="rounded-2xl bg-w-surface p-4 text-sm font-semibold text-w-muted">Nenhum vencimento proximo.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-w-border bg-white p-1.5 shadow-soft">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-full bg-w-surface sm:inline-flex" onClick={() => document.getElementById('budget-tabs')?.scrollBy({ left: -260, behavior: 'smooth' })}>
            <ChevronLeft size={16} />
          </button>
          <div id="budget-tabs" className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <button key={tab} type="button" onClick={() => setActive(tab)} className={`chip-category shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${active === tab ? 'bg-w-text text-white shadow-soft' : 'bg-w-surface text-w-muted hover:bg-[#FCE4EA] hover:text-w-text'}`}>
                {tab}
              </button>
            ))}
          </div>
          <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-full bg-w-surface sm:inline-flex" onClick={() => document.getElementById('budget-tabs')?.scrollBy({ left: 260, behavior: 'smooth' })}>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={() => { setSearch(''); setStatus(''); setDueFilter(''); }} gridClassName="lg:grid-cols-[1.6fr_1fr_1fr_auto]">
        <label className="block">
          <span className="label">Busca global</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-w-faint" size={18} />
            <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buffet, contrato, parcela, decoração..." />
          </div>
        </label>
        <FormSelect label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: 'Todos', value: '' }, ...paymentStatuses.map((item) => ({ label: item, value: item }))]} />
        <FormSelect label="Vencimento" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} options={[
          { label: 'Todos', value: '' },
          { label: 'Hoje', value: 'today' },
          { label: 'Vencidos', value: 'overdue' },
          { label: 'Próximos 7 dias', value: 'next7' },
          { label: 'Próximos 30 dias', value: 'next30' },
          { label: 'Sem vencimento', value: 'no_due' }
        ]} />
      </ResponsiveFilters>

      <section className="grid gap-3">
        {rows.length ? rows.map((item) => {
          const pending = getPendingValue(item.contracted_value, item.paid_value);
          const vendor = vendorById.get(item.vendor_id ?? '');
          const paidPct = percent(item.paid_value, item.contracted_value);
          const overdue = isBudgetOverdue(item);
          return (
            <article
              key={item.id}
              className="cursor-pointer rounded-3xl border border-w-border bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(225,29,72,0.20)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]"
              onClick={() => setDetailItem(item)}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-rose">{toPrimaryCategory(item.category)}</span>
                    <span className={overdue ? 'badge-red' : item.payment_status === 'pago' ? 'badge-green' : 'badge-gold'}>{overdue ? 'vencido' : item.payment_status}</span>
                  </div>
                  <h3 className="mt-3 truncate text-lg font-bold">{item.name}</h3>
                  <p className="mt-1 text-sm text-w-muted">Fornecedor: {vendor?.name ?? '-'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4">
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Contratado</p><p className="font-semibold">{formatMoney(item.contracted_value)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Pago</p><p className="font-semibold text-[#16A34A]">{formatMoney(item.paid_value)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Em aberto</p><p className="font-semibold text-[#D97706]">{formatMoney(pending)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Vencimento</p><p className={`font-semibold ${overdue ? 'text-[#DC2626]' : ''}`}>{formatDate(item.due_date)}</p></div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="h-1.5 overflow-hidden rounded-full bg-w-surface">
                  <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]"
                    onClick={(event) => {
                      event.stopPropagation();
                      startPayment(item);
                    }}
                  >
                    <DollarSign size={15} /> Pagar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDetailItem(item);
                    }}
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-3xl border border-dashed border-w-border-md bg-white p-8 text-center">
            <Receipt className="mx-auto text-w-faint" />
            <h3 className="mt-3 font-bold">Nenhum item financeiro encontrado</h3>
            <p className="mt-1 text-sm text-w-muted">Contrate um fornecedor ou adicione um gasto avulso.</p>
          </div>
        )}
      </section>

      <Modal open={Boolean(selectedDetailItem)} title="Detalhes financeiros" onClose={() => setDetailItem(null)}>
        {selectedDetailItem && (
          <div className="space-y-4">
            {selectedDetailItem.vendor_id && (
              <div className="rounded-2xl border border-w-gold/30 bg-w-gold-lt p-3 text-sm font-semibold text-[#92400E]">
                Este item foi gerado a partir de um fornecedor. Para alterar nome, categoria, valor contratado ou vencimento, edite o fornecedor na aba Fornecedores.
              </div>
            )}

            <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="badge-rose">{toPrimaryCategory(selectedDetailItem.category)}</span>
                <span className={isBudgetOverdue(selectedDetailItem) ? 'badge-red' : selectedDetailItem.payment_status === 'pago' ? 'badge-green' : 'badge-gold'}>
                  {isBudgetOverdue(selectedDetailItem) ? 'vencido' : selectedDetailItem.payment_status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-w-text">{selectedDetailItem.name}</h3>
              <p className="mt-1 text-sm text-w-muted">Fornecedor: {selectedDetailVendor?.name ?? '-'}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-w-surface p-3"><p className="text-[10px] font-bold uppercase text-w-faint">Contratado</p><p className="mt-1 font-bold">{formatMoney(selectedDetailItem.contracted_value)}</p></div>
                <div className="rounded-xl bg-w-surface p-3"><p className="text-[10px] font-bold uppercase text-w-faint">Pago</p><p className="mt-1 font-bold text-[#16A34A]">{formatMoney(selectedDetailItem.paid_value)}</p></div>
                <div className="rounded-xl bg-w-surface p-3"><p className="text-[10px] font-bold uppercase text-w-faint">Em aberto</p><p className="mt-1 font-bold text-[#D97706]">{formatMoney(getPendingValue(selectedDetailItem.contracted_value, selectedDetailItem.paid_value))}</p></div>
                <div className="rounded-xl bg-w-surface p-3"><p className="text-[10px] font-bold uppercase text-w-faint">Vencimento</p><p className="mt-1 font-bold">{formatDate(selectedDetailItem.due_date)}</p></div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase text-w-faint">Forma de pagamento</p><p className="mt-1 text-sm font-semibold text-w-text">{selectedDetailItem.payment_method || '-'}</p></div>
              </div>
              <div className="mt-4">
                <FormTextarea label="Observações financeiras" value={detailNotes} onChange={(event) => setDetailNotes(event.target.value)} />
              </div>
            </section>

            <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <h3 className="text-sm font-bold text-w-text">Pagamentos</h3>
              {paymentRecords.rows.filter((record) => record.budget_item_id === selectedDetailItem.id).length > 0 ? (
                <div className="mt-3 space-y-2">
                  {paymentRecords.rows.filter((record) => record.budget_item_id === selectedDetailItem.id).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="grid w-full gap-2 rounded-xl bg-w-surface p-3 text-left text-sm sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
                      onClick={() => setSelectedPaymentRecord(record)}
                    >
                      <span className="font-bold text-w-rose">{record.ap_number}</span>
                      <span className="font-semibold text-w-text">{formatMoney(record.amount)} · {record.payment_method || '-'}</span>
                      <span className="font-semibold text-w-muted">{formatDate(record.payment_date)}</span>
                      <span className={paymentRecordTone(record.status)}>{paymentRecordStatusLabel(record.status)}</span>
                    </button>
                  ))}
                </div>
              ) : paymentHistory(selectedDetailItem.notes).length > 0 ? (
                <div className="mt-3 space-y-2">
                  {paymentHistory(selectedDetailItem.notes).map((entry, index) => (
                    <div key={`${entry}-${index}`} className="rounded-xl bg-w-surface p-3 text-sm font-semibold text-w-text">
                      {entry}
                    </div>
                  ))}
                </div>
              ) : Number(selectedDetailItem.paid_value ?? 0) > 0 ? (
                <div className="mt-3 grid gap-2 rounded-xl bg-w-surface p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Data</p><p className="text-sm font-semibold">{formatDate(selectedDetailItem.payment_date)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Valor</p><p className="text-sm font-semibold text-[#16A34A]">{formatMoney(selectedDetailItem.paid_value)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Forma</p><p className="text-sm font-semibold">{selectedDetailItem.payment_method || '-'}</p></div>
                  {selectedDetailItem.receipt_url && <a className="btn-secondary px-3" href={selectedDetailItem.receipt_url} target="_blank" rel="noreferrer"><FileText size={15} /></a>}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-w-surface p-3 text-sm font-semibold text-w-muted">Nenhum pagamento registrado.</p>
              )}
            </section>

            <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <h3 className="text-sm font-bold text-w-text">Anexos</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-dashed border-w-border-md p-3">
                  <p className="text-sm font-bold">Comprovante</p>
                  {selectedDetailItem.receipt_url && <a className="mt-2 inline-flex text-sm font-semibold text-w-rose hover:underline" href={selectedDetailItem.receipt_url} target="_blank" rel="noreferrer">Ver comprovante</a>}
                  <div className="mt-3">
                    <FileUpload folder="comprovantes" label={selectedDetailItem.receipt_url ? 'Substituir comprovante' : 'Anexar comprovante'} onUploaded={(url) => items.update(selectedDetailItem.id, { receipt_url: url } as Partial<BudgetItem>)} />
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-w-border-md p-3">
                  <p className="text-sm font-bold">Contrato</p>
                  {selectedDetailVendor?.contract_url ? (
                    <a className="mt-2 inline-flex text-sm font-semibold text-w-rose hover:underline" href={selectedDetailVendor.contract_url} target="_blank" rel="noreferrer">Abrir contrato</a>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-w-muted">Nenhum contrato vinculado.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              {selectedDetailVendor && <button type="button" className="btn-secondary" onClick={() => { setDetailItem(null); navigate('/fornecedores'); }}>Abrir fornecedor</button>}
              <button type="button" className="btn-secondary" onClick={() => items.update(selectedDetailItem.id, { notes: detailNotes || null } as Partial<BudgetItem>)}>Salvar observações</button>
              {!selectedDetailItem.vendor_id && <button type="button" className="btn-secondary" onClick={() => { start(selectedDetailItem); setDetailItem(null); }}>Editar item</button>}
              {!selectedDetailItem.vendor_id && <button type="button" className="btn-secondary text-[#DC2626]" onClick={() => { setDeleting(selectedDetailItem); setDetailItem(null); }}>Excluir gasto</button>}
              <button type="button" className="btn-primary" onClick={() => startPayment(selectedDetailItem)}>
                <DollarSign size={15} /> Registrar pagamento
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={open} title={editing ? 'Editar gasto' : 'Novo gasto'} onClose={() => setOpen(false)}>
        <form className="-m-5 flex max-h-[calc(92vh-80px)] flex-col" onSubmit={submit}>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <section className="glass rounded-3xl p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <CategorySelect value={form.category} options={categoryOptions} onChange={(value) => setForm({ ...form, category: value })} onCreate={createCategory} />
                <CurrencyInput label="Valor estimado" value={form.estimated_value} onValueChange={(value) => setForm({ ...form, estimated_value: value })} />
                <CurrencyInput label="Valor contratado" value={form.contracted_value} onValueChange={(value) => setForm({ ...form, contracted_value: value })} />
                <CurrencyInput label="Valor pago" value={form.paid_value} onValueChange={(value) => setForm({ ...form, paid_value: value })} />
                <FormSelect label="Fornecedor" value={form.vendor_id} onChange={(event) => setForm({ ...form, vendor_id: event.target.value })} options={[{ label: 'Nenhum', value: '' }, ...vendors.rows.map((vendor) => ({ label: vendor.name, value: vendor.id }))]} />
                <FormInput label="Vencimento" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                <FormInput label="Forma de pagamento" value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} />
              </div>
            </section>
            <FormTextarea label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <FormTextarea label="Observações" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <div className="rounded-2xl border border-dashed border-w-border-md p-4">
              <FileUpload folder="comprovantes" onUploaded={(url) => setForm({ ...form, receipt_url: url })} />
              {form.receipt_url && <a className="ml-3 text-sm font-semibold text-w-rose" href={form.receipt_url} target="_blank" rel="noreferrer">Comprovante anexado</a>}
            </div>
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-w-border bg-white p-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(paying)}
        title="Registrar pagamento"
        onClose={() => {
          setPaymentConfirmOpen(false);
          setPaying(null);
        }}
      >
        {paying && (
          (() => {
            const vendorName = paying.vendor_id ? vendorById.get(paying.vendor_id)?.name ?? paying.name : paying.name;
            const contracted = Number(paying.contracted_value ?? 0);
            const alreadyPaid = Number(paying.paid_value ?? 0);
            const remaining = getPendingValue(contracted, alreadyPaid);
            const paymentAmount = Number(paymentForm.amount ?? 0);
            const amountTooHigh = paymentAmount > remaining && paymentAmount > 0;
            const amountValid = paymentAmount > 0 && paymentAmount <= remaining;
            const formValid = amountValid && Boolean(paymentForm.payment_date) && Boolean(paymentForm.payment_method);
            const nextPaid = alreadyPaid + (amountValid ? paymentAmount : 0);
            const nextRemaining = Math.max(0, contracted - nextPaid);
            const paidPct = percent(alreadyPaid, contracted);
            const nextPct = percent(nextPaid, contracted);
            const currentStatus = paymentStatusLabel(contracted, alreadyPaid);
            const progressColor = amountTooHigh ? 'bg-[#EF4444]' : alreadyPaid > 0 && remaining > 0 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]';

            return (
              <form className="-m-5 flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden bg-white sm:-m-6 sm:max-h-[calc(92vh-80px)]" onSubmit={submitPayment}>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-w-surface/40 p-5 sm:p-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-w-faint">Fornecedor</p>
                    <p className="mt-1 truncate text-lg font-extrabold text-w-text">{vendorName}</p>
                  </div>

                  <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-w-faint">Valor contratado</p>
                        <p className="mt-1 text-base font-extrabold text-w-text">{formatMoney(contracted)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-w-faint">Já pago</p>
                        <p className="mt-1 text-base font-extrabold text-[#16A34A]">{formatMoney(alreadyPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-w-faint">Saldo restante</p>
                        <p className="mt-1 text-base font-extrabold text-w-text">{formatMoney(remaining)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <span className={`badge ${currentStatus === 'Pago' ? 'badge-green' : currentStatus === 'Parcial' ? 'badge-gold' : 'badge-muted'}`}>
                        {currentStatus}
                      </span>
                      <span className="text-xs font-bold text-w-muted">{paidPct}% pago</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-w-border">
                      <div className={`h-full rounded-full ${progressColor} transition-[width] duration-300`} style={{ width: `${paidPct}%` }} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
                    <div className="grid gap-4 md:grid-cols-2">
                      <CurrencyInput
                        label="Valor do pagamento"
                        value={paymentForm.amount}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, amount: value })}
                        hint={`Saldo disponível para pagamento: ${formatMoney(remaining)}`}
                        error={amountTooHigh ? 'O valor informado ultrapassa o saldo restante deste fornecedor.' : undefined}
                      />

                      <label className="block">
                        <span className="field-label">Data</span>
                        <div className="relative">
                          <CalendarClock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-w-faint" size={16} />
                          <input
                            className="field-base pl-10"
                            type="date"
                            value={paymentForm.payment_date}
                            onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })}
                            required
                          />
                        </div>
                      </label>
                    </div>

                    <div className="mt-4">
                      <p className="field-label">Forma de pagamento</p>
                      <div className="flex flex-wrap gap-2">
                        {paymentMethodOptions.map((method) => (
                          <button
                            key={method}
                            type="button"
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              paymentForm.payment_method === method
                                ? 'border-w-rose bg-w-rose text-white shadow-rose'
                                : 'border-w-border bg-white text-w-muted hover:border-w-rose-md hover:bg-w-rose-lt hover:text-w-rose'
                            }`}
                            onClick={() => setPaymentForm({ ...paymentForm, payment_method: method })}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-dashed border-w-border-md bg-white p-4 shadow-soft">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-w-text">Comprovante</p>
                        <p className="mt-1 text-sm text-w-muted">Anexe um comprovante, se houver</p>
                        <p className="mt-0.5 text-xs font-semibold text-w-faint">PDF, PNG ou JPG</p>
                      </div>
                      <FileUpload folder="comprovantes" label="Anexar arquivo" onUploaded={(url) => setPaymentForm({ ...paymentForm, receipt_url: url })} />
                    </div>
                    {paymentForm.receipt_url && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-w-surface p-3 text-sm font-semibold text-w-text">
                        <a className="inline-flex min-w-0 items-center gap-2 text-w-text hover:text-w-rose" href={paymentForm.receipt_url} target="_blank" rel="noreferrer">
                          <FileText size={15} className="shrink-0" />
                          <span className="truncate">{receiptFileName(paymentForm.receipt_url)}</span>
                        </a>
                        <button type="button" className="btn-ghost text-[#DC2626]" onClick={() => setPaymentForm({ ...paymentForm, receipt_url: '' })}>
                          Remover
                        </button>
                      </div>
                    )}
                  </section>

                  <FormTextarea
                    label="Observação"
                    value={paymentForm.notes}
                    onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                    placeholder="Ex: Entrada do espaço, pagamento parcial via Pix..."
                    rows={3}
                  />

                  <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
                    <p className="text-sm font-bold text-w-text">Você está registrando:</p>
                    <div className="mt-3 grid gap-2 text-sm text-w-muted sm:grid-cols-2">
                      <div className="flex justify-between gap-3"><span>Valor</span><strong className="text-w-text">{formatMoney(paymentAmount)}</strong></div>
                      <div className="flex justify-between gap-3"><span>Data</span><strong className="text-w-text">{paymentForm.payment_date ? formatDate(paymentForm.payment_date) : '-'}</strong></div>
                      <div className="flex justify-between gap-3"><span>Forma</span><strong className="text-w-text">{paymentForm.payment_method || '-'}</strong></div>
                      <div className="flex justify-between gap-3"><span>Novo total pago</span><strong className="text-[#16A34A]">{formatMoney(nextPaid)}</strong></div>
                      <div className="flex justify-between gap-3 sm:col-span-2"><span>Novo saldo restante</span><strong className={nextRemaining > 0 ? 'text-w-text' : 'text-[#16A34A]'}>{formatMoney(nextRemaining)}</strong></div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-w-border">
                      <div className={`h-full rounded-full ${amountTooHigh ? 'bg-[#EF4444]' : nextRemaining > 0 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'} transition-[width] duration-300`} style={{ width: `${nextPct}%` }} />
                    </div>
                  </section>
                </div>

                <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-w-border bg-white p-4">
                  <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancelar</button>
                  <button className="btn-primary" disabled={!formValid}>Confirmar pagamento</button>
                </div>
              </form>
            );
          })()
        )}
      </Modal>

      <ConfirmDialog
        open={paymentConfirmOpen}
        title="Confirmar pagamento?"
        description="Tem certeza que deseja confirmar este pagamento? Essa a??o ser? registrada no hist?rico financeiro."
        confirmLabel="Sim, confirmar pagamento"
        variant="success"
        loading={paymentSubmitting}
        details={paying ? [
          { label: 'Fornecedor', value: paying.vendor_id ? vendorById.get(paying.vendor_id)?.name ?? paying.name : paying.name },
          { label: 'Valor', value: formatMoney(Number(paymentForm.amount ?? 0)) },
          { label: 'Forma', value: paymentForm.payment_method || '-' },
          { label: 'Vencimento', value: paying.due_date ? formatDate(paying.due_date) : '-' }
        ] : undefined}
        onCancel={() => setPaymentConfirmOpen(false)}
        onConfirm={confirmPayment}
      />

      <Modal open={Boolean(selectedPaymentRecord)} title="Detalhes do pagamento" onClose={() => setSelectedPaymentRecord(null)}>
        {selectedPaymentRecord && (
          (() => {
            const vendor = selectedPaymentRecord.vendor_id ? vendorById.get(selectedPaymentRecord.vendor_id) : undefined;
            const item = selectedPaymentRecord.budget_item_id ? itemById.get(selectedPaymentRecord.budget_item_id) : undefined;
            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-w-border bg-w-surface p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-w-faint">Autorização de pagamento</p>
                    <h3 className="mt-1 text-2xl font-bold text-w-text">{selectedPaymentRecord.ap_number}</h3>
                  </div>
                  <span className={paymentRecordTone(selectedPaymentRecord.status)}>{paymentRecordStatusLabel(selectedPaymentRecord.status)}</span>
                </div>

                <dl className="grid gap-3 rounded-2xl border border-w-border bg-white p-4 text-sm shadow-soft sm:grid-cols-2">
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Fornecedor</dt><dd className="mt-1 font-semibold text-w-text">{vendor?.name ?? '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Item financeiro</dt><dd className="mt-1 font-semibold text-w-text">{item?.name ?? '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Valor</dt><dd className="mt-1 font-semibold text-w-text">{formatMoney(selectedPaymentRecord.amount)}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Forma</dt><dd className="mt-1 font-semibold text-w-text">{selectedPaymentRecord.payment_method || '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Data do pagamento</dt><dd className="mt-1 font-semibold text-w-text">{formatDate(selectedPaymentRecord.payment_date)}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Data da confirmação</dt><dd className="mt-1 font-semibold text-w-text">{selectedPaymentRecord.confirmed_at ? formatDate(selectedPaymentRecord.confirmed_at.slice(0, 10)) : '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Usuário responsável</dt><dd className="mt-1 font-semibold text-w-text">{selectedPaymentRecord.confirmed_by || '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Comprovante</dt><dd className="mt-1 font-semibold text-w-text">{selectedPaymentRecord.receipt_file_url ? 'Anexado' : 'Nenhum comprovante anexado'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-w-faint">Observação</dt><dd className="mt-1 font-semibold text-w-text">{selectedPaymentRecord.notes || '-'}</dd></div>
                </dl>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {selectedPaymentRecord.status === 'confirmed' && (
                    <button type="button" className="btn-secondary text-[#DC2626]" onClick={() => setCancelingPaymentRecord(selectedPaymentRecord)}>
                      Cancelar pagamento
                    </button>
                  )}
                  {selectedPaymentRecord.receipt_file_url ? (
                    <a className="btn-secondary text-center" href={selectedPaymentRecord.receipt_file_url} target="_blank" rel="noreferrer">
                      Ver comprovante
                    </a>
                  ) : (
                    <button type="button" className="btn-secondary" onClick={() => setMessage('Nenhum comprovante anexado para esta AP.')}>
                      Ver comprovante
                    </button>
                  )}
                  <button type="button" className="btn-primary" onClick={() => setSelectedPaymentRecord(null)}>Fechar</button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelingPaymentRecord)}
        title="Cancelar pagamento?"
        description="Tem certeza que deseja cancelar este pagamento? O valor ser? removido do total pago e o saldo restante ser? recalculado. A AP continuar? registrada no hist?rico."
        confirmLabel="Sim, cancelar pagamento"
        variant="danger"
        loading={paymentSubmitting}
        details={cancelingPaymentRecord ? [
          { label: 'AP', value: cancelingPaymentRecord.ap_number },
          { label: 'Valor', value: formatMoney(cancelingPaymentRecord.amount) },
          { label: 'Forma', value: cancelingPaymentRecord.payment_method || '-' }
        ] : undefined}
        onCancel={() => setCancelingPaymentRecord(null)}
        onConfirm={cancelPaymentRecord}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir item?"
        description="Essa ação pode remover informações importantes. Tem certeza que deseja continuar?"
        confirmLabel="Sim, excluir"
        variant="danger"
        details={deleting ? [
          { label: 'Item', value: deleting.name },
          { label: 'Categoria', value: deleting.category },
          { label: 'Valor', value: formatMoney(Number(deleting.contracted_value ?? deleting.estimated_value ?? 0)) }
        ] : undefined}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          if (deleting.vendor_id) {
            setMessage('Este item foi gerado por um fornecedor. Exclua ou edite o fornecedor na aba Fornecedores.');
            setDeleting(null);
            return;
          }
          await items.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

