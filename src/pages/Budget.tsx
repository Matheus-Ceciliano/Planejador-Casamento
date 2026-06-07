import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetCategory, BudgetItem, Vendor } from '../types';
import { budgetCategories, categorySlugMap } from '../utils/constants';
import { getPaymentStatus, getPendingValue, isBudgetOverdue, isContractedVendor, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';
import { syncVendorBudgetItem } from '../utils/vendorBudgetSync';

const preferredTabs = ['Todos', 'Buffet', 'Decoração', 'Foto e Vídeo', 'Música / DJ', 'Cerimonial', 'Espaço', 'Bebidas', 'Outros'];
const paymentStatuses = ['pendente', 'pago parcialmente', 'pago', 'vencido', 'cancelado'];
const chartColors = ['#E11D48', '#2563EB', '#16A34A', '#F97316', '#7C3AED', '#0F766E', '#D97706', '#52525B'];

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

function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')}k`;
  return formatMoney(value).replace(',00', '');
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
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

function Kpi({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: string }) {
  return (
    <div className="glass rounded-3xl p-4 shadow-[0_18px_55px_rgba(24,24,27,0.08)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-w-faint">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold text-w-text">{value}</p>
      <p className={`mt-2 text-xs font-semibold ${tone}`}>{helper}</p>
    </div>
  );
}

function ProgressLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-w-text">{label}</span>
        <span className="font-bold text-w-muted">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/70 ring-1 ring-white/70">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Budget() {
  const navigate = useNavigate();
  const params = useParams();
  const { wedding } = useWedding();
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const categories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const initial = params.category ? categorySlugMap[params.category] ?? 'Outros' : 'Todos';
  const [active, setActive] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [paying, setPaying] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({ ...blank, category: initial === 'Todos' ? 'Buffet' : initial });
  const [paymentForm, setPaymentForm] = useState(paymentBlank);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [message, setMessage] = useState('');
  const syncInFlight = useRef(new Set<string>());

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor])), [vendors.rows]);
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
  }, [budgetItemsByVendorId, vendors.rows]);

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

  const categoryData = useMemo(() => {
    const grouped = items.rows.reduce<Record<string, number>>((acc, item) => {
      const key = toPrimaryCategory(item.category);
      acc[key] = (acc[key] ?? 0) + Number(item.contracted_value ?? 0);
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [items.rows]);

  const plannedPaidData = [
    { name: 'Planejado', value: totals.planned },
    { name: 'Comprometido', value: totals.committed },
    { name: 'Pago', value: totals.paid }
  ];

  const evolutionData = useMemo(() => {
    const monthly = items.rows.reduce<Record<string, number>>((acc, item) => {
      const key = (item.due_date ?? 'Sem data').slice(0, 7);
      acc[key] = (acc[key] ?? 0) + Number(item.contracted_value ?? 0);
      return acc;
    }, {});
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));
  }, [items.rows]);

  const nextDue = useMemo(
    () =>
      items.rows
        .filter((item) => item.due_date && getPendingValue(item.contracted_value, item.paid_value) > 0)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0],
    [items.rows]
  );

  const expensiveCategory = categoryData[0];
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
    if (editing) await items.update(editing.id, payload as Partial<BudgetItem>);
    else await items.create(payload as Partial<BudgetItem>);
    setOpen(false);
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!paying) return;
    const nextPaid = Number(paying.paid_value ?? 0) + Number(paymentForm.amount ?? 0);
    await items.update(paying.id, {
      paid_value: nextPaid,
      payment_status: getPaymentStatus(paying.contracted_value, nextPaid),
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method || paying.payment_method,
      receipt_url: paymentForm.receipt_url || paying.receipt_url,
      notes: [paying.notes, paymentForm.notes].filter(Boolean).join('\n')
    } as Partial<BudgetItem>);
    if (paying.vendor_id) {
      await vendors.update(paying.vendor_id, { paid_value: nextPaid, due_date: paying.due_date } as Partial<Vendor>);
    }
    setMessage(`Pagamento registrado para ${paying.name}.`);
    setPaying(null);
  }

  const dueGroups = {
    today: items.rows.filter((item) => dueBucket(item) === 'today'),
    next7: items.rows.filter((item) => dueBucket(item) === 'next7'),
    overdue: items.rows.filter((item) => dueBucket(item) === 'overdue')
  };

  return (
    <div className="space-y-5 text-w-text">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-w-faint">Central financeira</p>
          <h1 className="page-title mt-1">Orçamento</h1>
          <p className="mt-1 text-sm text-w-muted">Contratos, parcelas, comprovantes e vencimentos em uma única visão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigate('/fornecedores')}><ExternalLink size={16} /> Fornecedores</button>
          <button className="btn-primary" onClick={() => start()}><Plus size={16} /> Gasto</button>
        </div>
      </div>

      {message && <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]">{message}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Orçamento total" value={formatMoney(totals.planned)} helper="Planejado nas configurações" tone="text-w-muted" />
        <Kpi label="Comprometido" value={formatMoney(totals.committed)} helper={`${totals.committedPct}% contratado`} tone="text-w-rose" />
        <Kpi label="Pago" value={formatMoney(totals.paid)} helper={`${totals.paidPct}% pago`} tone="text-[#16A34A]" />
        <Kpi label="Restante" value={formatMoney(totals.remaining)} helper={`${formatMoney(totals.pending)} em aberto`} tone="text-[#D97706]" />
      </section>

      <section className="glass rounded-3xl p-4 shadow-[0_20px_70px_rgba(24,24,27,0.08)]">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-5">
            <ProgressLine label="Contratado" value={totals.committedPct} color="linear-gradient(90deg,#E11D48,#FB7185)" />
            <ProgressLine label="Pago" value={totals.paidPct} color="linear-gradient(90deg,#16A34A,#86EFAC)" />
          </div>
          <div className="rounded-2xl bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-w-rose" />
              <h2 className="text-sm font-bold">Insights automáticos</h2>
            </div>
            <div className="space-y-2 text-sm text-w-muted">
              <p><strong className="text-w-text">Atenção:</strong> você já comprometeu {totals.committedPct}% do orçamento.</p>
              <p><strong className="text-w-text">Disponível:</strong> ainda restam {formatMoney(totals.remaining)} do planejado.</p>
              <p><strong className="text-w-text">Próximo vencimento:</strong> {nextDue ? `${nextDue.name} em ${formatDate(nextDue.due_date)}` : 'nenhum vencimento pendente'}.</p>
              <p><strong className="text-w-text">Categoria mais cara:</strong> {expensiveCategory ? `${expensiveCategory.name} (${formatMoney(expensiveCategory.value)})` : 'sem dados'}.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-w-border bg-white p-4 shadow-card">
          <h2 className="text-sm font-bold">Gastos por categoria</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {categoryData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-w-border bg-white p-4 shadow-card">
          <h2 className="text-sm font-bold">Planejado x Pago</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <BarChart data={plannedPaidData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={96} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#E11D48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-w-border bg-white p-4 shadow-card">
          <h2 className="text-sm font-bold">Evolução dos gastos</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          { label: 'Vence hoje', rows: dueGroups.today, tone: 'border-[#FDE68A] bg-[#FEFCE8]', icon: CalendarClock },
          { label: 'Vence em 7 dias', rows: dueGroups.next7, tone: 'border-[#BFDBFE] bg-[#EFF6FF]', icon: WalletCards },
          { label: 'Vencidos', rows: dueGroups.overdue, tone: 'border-[#FECACA] bg-[#FEF2F2]', icon: AlertTriangle }
        ].map(({ label, rows: groupRows, tone, icon: Icon }) => (
          <button key={label} type="button" className={`rounded-3xl border p-4 text-left ${tone}`} onClick={() => setDueFilter(label === 'Vencidos' ? 'overdue' : label === 'Vence hoje' ? 'today' : 'next7')}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold"><Icon size={17} /> {label}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{groupRows.length}</span>
            </div>
            <p className="mt-3 text-xl font-bold">{formatMoney(groupRows.reduce((sum, item) => sum + getPendingValue(item.contracted_value, item.paid_value), 0))}</p>
          </button>
        ))}
      </section>

      <section className="rounded-3xl border border-w-border bg-white p-2 shadow-card">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-full bg-w-surface sm:inline-flex" onClick={() => document.getElementById('budget-tabs')?.scrollBy({ left: -260, behavior: 'smooth' })}>
            <ChevronLeft size={16} />
          </button>
          <div id="budget-tabs" className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <button key={tab} type="button" onClick={() => setActive(tab)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition ${active === tab ? 'bg-w-text text-white' : 'bg-w-surface text-w-muted hover:text-w-text'}`}>
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
            <article key={item.id} className="rounded-3xl border border-w-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-rose">{toPrimaryCategory(item.category)}</span>
                    <span className={overdue ? 'badge-red' : item.payment_status === 'pago' ? 'badge-green' : 'badge-gold'}>{overdue ? 'vencido' : item.payment_status}</span>
                  </div>
                  <h3 className="mt-3 truncate text-lg font-bold">{item.name}</h3>
                  <p className="mt-1 text-sm text-w-muted">Fornecedor: {vendor?.name ?? '-'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[560px]">
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Contratado</p><p className="font-semibold">{formatMoney(item.contracted_value)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Pago</p><p className="font-semibold text-[#16A34A]">{formatMoney(item.paid_value)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Falta</p><p className="font-semibold text-[#D97706]">{formatMoney(pending)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-w-faint">Vencimento</p><p className={`font-semibold ${overdue ? 'text-[#DC2626]' : ''}`}>{formatDate(item.due_date)}</p></div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="h-2 overflow-hidden rounded-full bg-w-surface">
                  <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" onClick={() => { setPaying(item); setPaymentForm(paymentBlank); }}><DollarSign size={15} /> Pagar</button>
                  <FileUpload folder="comprovantes" compact label="Comprovante" onUploaded={(url) => items.update(item.id, { receipt_url: url } as Partial<BudgetItem>)} />
                  {item.receipt_url && <a className="btn-secondary px-3" href={item.receipt_url} target="_blank" rel="noreferrer"><FileText size={15} /></a>}
                  <button type="button" className="btn-secondary" onClick={() => start(item)}>Editar</button>
                  <button type="button" className="btn-secondary px-3 text-[#DC2626]" onClick={() => setDeleting(item)}><Trash2 size={15} /></button>
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

      <Modal open={Boolean(paying)} title="Registrar pagamento" onClose={() => setPaying(null)}>
        {paying && (
          <form className="space-y-4" onSubmit={submitPayment}>
            <div className="glass rounded-3xl p-4">
              <p className="text-sm text-w-muted">{paying.name}</p>
              <p className="mt-2 text-2xl font-bold">{formatMoney(getPendingValue(paying.contracted_value, paying.paid_value))}</p>
              <p className="text-xs font-semibold text-w-muted">pendente</p>
            </div>
            <CurrencyInput label="Valor do pagamento" value={paymentForm.amount} onValueChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} />
            <FormInput label="Data" type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} />
            <FormInput label="Forma de pagamento" value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })} />
            <FileUpload folder="comprovantes" onUploaded={(url) => setPaymentForm({ ...paymentForm, receipt_url: url })} />
            <FormTextarea label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancelar</button>
              <button className="btn-primary" disabled={paymentForm.amount <= 0}>Salvar pagamento</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir gasto"
        message={`Tem certeza que deseja excluir ${deleting?.name ?? 'este gasto'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await items.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
