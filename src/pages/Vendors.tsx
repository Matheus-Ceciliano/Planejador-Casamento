import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileText,
  Handshake,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Mail,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Upload,
  X
} from 'lucide-react';
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { BudgetCategory, BudgetItem, FileRecord, Vendor } from '../types';
import { vendorCategories } from '../utils/constants';
import { getPaymentStatus, getPendingValue, isContractedVendor, normalizeVendorStatus, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';
import { syncVendorBudgetItem } from '../utils/vendorBudgetSync';
import { buildWhatsAppChatLink } from '../utils/whatsappService';

const statusColumns = [
  { key: 'pesquisando', label: 'Pesquisando', color: '#F59E0B' },
  { key: 'contratado', label: 'Contratados', color: '#22C55E' },
  { key: 'cancelado', label: 'Cancelado', color: '#6B7280' }
];

const blankVendor = {
  name: '',
  category: 'Buffet',
  contact_name: '',
  phone: '',
  email: '',
  instagram: '',
  site: '',
  contracted_value: 0,
  paid_value: 0,
  due_date: '',
  status: 'pesquisando',
  contract_url: '',
  notes: ''
};

const financeOptions = [
  { label: 'Todos', value: '' },
  { label: 'Em aberto', value: 'pending' },
  { label: 'Pago', value: 'paid' },
  { label: 'Vencido', value: 'overdue' },
  { label: 'No orçamento', value: 'budget' }
];

type VendorForm = typeof blankVendor;
type DocumentKind = 'Contrato PDF' | 'Comprovante' | 'Orçamento' | 'Foto';
const blankPaymentPlan = {
  due_date: '',
  payment_method: '',
  notes: ''
};
const paymentHistoryPrefix = '[PAGAMENTO] ';

function normalizeVendorWorkflowStatus(status?: string | null) {
  const normalized = normalizeVendorStatus(status);
  if (normalized === 'contratado' || normalized === 'cancelado') return normalized;
  return 'pesquisando';
}

function moneyCompact(value: number) {
  return value >= 1000 ? `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')}k` : formatMoney(value);
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function paymentBadge(vendor: Vendor) {
  const pending = getPendingValue(vendor.contracted_value, vendor.paid_value);
  if (vendor.due_date && pending > 0 && new Date(`${vendor.due_date}T23:59:59`) < new Date()) return 'Vencido';
  return getPaymentStatus(vendor.contracted_value, vendor.paid_value);
}

function paymentHistory(notes?: string | null) {
  return String(notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(paymentHistoryPrefix))
    .map((line) => line.slice(paymentHistoryPrefix.length));
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
    setName('');
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <FormSelect label="Categoria" value={value} onChange={(event) => onChange(event.target.value)} options={options.map((item) => ({ label: item, value: item }))} />
      {!creating ? (
        <button type="button" className="text-xs font-semibold text-w-rose hover:underline" onClick={() => setCreating(true)}>
          + Criar nova categoria
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

function VendorCard({
  vendor,
  budgetItem,
  onOpen,
  onDragStart
}: {
  vendor: Vendor;
  budgetItem?: BudgetItem;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}) {
  const pending = getPendingValue(vendor.contracted_value, vendor.paid_value);
  const nextDue = budgetItem?.due_date ?? vendor.due_date;
  const status = paymentBadge(vendor);
  const statusTone = status === 'pago' ? 'badge-green' : status === 'Vencido' ? 'badge-red' : 'badge-gold';

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-soft transition duration-200 hover:-translate-y-[3px] hover:border-[rgba(225,29,72,0.25)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-w-text">{vendor.name}</h3>
          <p className="mt-1 text-xs font-medium text-w-muted">{toPrimaryCategory(vendor.category)}</p>
        </div>
        <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-w-muted transition hover:bg-w-surface hover:text-w-text" aria-label="Ações">
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-w-faint">Contratado</p>
          <p className="mt-1 text-sm font-semibold">{moneyCompact(vendor.contracted_value)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-w-faint">Pago</p>
          <p className="mt-1 text-sm font-semibold text-[#16A34A]">{moneyCompact(vendor.paid_value)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-w-faint">Falta</p>
          <p className="mt-1 text-sm font-semibold text-[#D97706]">{moneyCompact(pending)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#FAFAFA] p-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase text-w-faint">Próximo vencimento</p>
          <p className="mt-1 text-sm font-semibold text-w-text">{formatDate(nextDue ?? null)}</p>
        </div>
        <span className={statusTone}>{status}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {vendor.contract_url && <span className="badge-muted">Contrato</span>}
        {budgetItem && <span className="badge-green">No orçamento</span>}
      </div>
    </article>
  );
}

function Timeline({ vendor, budgetItems }: { vendor: Vendor; budgetItems: BudgetItem[] }) {
  const hasBudget = budgetItems.length > 0;
  const normalizedStatus = normalizeVendorWorkflowStatus(vendor.status);
  const hasQuote = normalizedStatus !== 'pesquisando';
  const hasContract = normalizedStatus === 'contratado';

  const steps = [
    { label: 'Primeiro contato', done: true },
    { label: 'Orçamento recebido', done: hasQuote || hasBudget },
    { label: 'Contratação', done: hasContract || hasBudget }
  ];
  const payments = budgetItems.flatMap((item) => paymentHistory(item.notes));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-w-text">Timeline</h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 rounded-xl bg-white/70 p-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step.done ? 'bg-[#16A34A] text-white' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
              {step.done ? <CheckCircle2 size={15} /> : <CalendarClock size={15} />}
            </span>
            <p className={`text-sm font-medium ${step.done ? 'text-w-text' : 'text-w-muted'}`}>{step.label}</p>
          </div>
        ))}
      </div>
      {payments.length > 0 && (
        <div className="rounded-2xl border border-w-border bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-w-faint">Histórico de pagamentos</p>
          <div className="mt-2 space-y-2">
            {payments.map((payment, index) => (
              <div key={`${payment}-${index}`} className="rounded-xl bg-w-surface p-2.5 text-xs font-semibold text-w-text">
                {payment}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Vendors() {
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const customCategories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const files = useWeddingTable<FileRecord>('files', 'created_at');
  const [form, setForm] = useState<VendorForm>(blankVendor);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [financeFilter, setFinanceFilter] = useState('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [dragOverStatus, setDragOverStatus] = useState('');
  const [message, setMessage] = useState('');
  const [paymentVendor, setPaymentVendor] = useState<Vendor | null>(null);
  const [paymentPlan, setPaymentPlan] = useState(blankPaymentPlan);
  const [paymentError, setPaymentError] = useState('');
  const syncInFlight = useRef(new Set<string>());

  const categoryOptions = useMemo(() => {
    const custom = customCategories.rows.map((item) => toPrimaryCategory(item.name)).filter(Boolean);
    return Array.from(new Set([...vendorCategories, ...custom]));
  }, [customCategories.rows]);

  const budgetByVendor = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    budgetItems.rows.forEach((item) => {
      if (!item.vendor_id) return;
      map.set(item.vendor_id, [...(map.get(item.vendor_id) ?? []), item]);
    });
    return map;
  }, [budgetItems.rows]);

  const rows = useMemo(
    () =>
      vendors.rows.filter((vendor) => {
        const pending = getPendingValue(vendor.contracted_value, vendor.paid_value);
        const hasBudget = Boolean(budgetByVendor.get(vendor.id)?.length);
        const overdue = Boolean(vendor.due_date && pending > 0 && new Date(`${vendor.due_date}T23:59:59`) < new Date());
        const financeMatch =
          !financeFilter ||
          (financeFilter === 'pending' && pending > 0) ||
          (financeFilter === 'paid' && pending <= 0 && Number(vendor.contracted_value ?? 0) > 0) ||
          (financeFilter === 'overdue' && overdue) ||
          (financeFilter === 'budget' && hasBudget);

        return (
          `${vendor.name} ${vendor.phone ?? ''} ${vendor.category}`.toLowerCase().includes(search.toLowerCase()) &&
          (!category || toPrimaryCategory(vendor.category) === category) &&
          (!statusFilter || normalizeVendorWorkflowStatus(vendor.status) === normalizeVendorWorkflowStatus(statusFilter)) &&
          financeMatch
        );
      }),
    [budgetByVendor, category, financeFilter, search, statusFilter, vendors.rows]
  );

  const activeFilterCount = [search.trim(), category, statusFilter, financeFilter].filter(Boolean).length;

  function existingBudgetItemsFor(vendorId: string) {
    return budgetByVendor.get(vendorId) ?? [];
  }

  async function syncContractedVendor(vendor: Vendor, debug = false, forceCreate = false) {
    if (!isContractedVendor(vendor)) return null;
    if (syncInFlight.current.has(vendor.id)) return null;

    syncInFlight.current.add(vendor.id);
    try {
      return await syncVendorBudgetItem(vendor, existingBudgetItemsFor(vendor.id), budgetItems, { debug, forceCreate });
    } finally {
      syncInFlight.current.delete(vendor.id);
    }
  }

  function openPaymentModal(vendor: Vendor) {
    const today = new Date().toISOString().slice(0, 10);
    setPaymentVendor(vendor);
    setPaymentPlan({ ...blankPaymentPlan, due_date: vendor.due_date ?? today });
    setPaymentError('');
  }

  useEffect(() => {
    vendors.rows
      .filter((vendor) => vendor.category !== toPrimaryCategory(vendor.category))
      .forEach((vendor) => vendors.update(vendor.id, { category: toPrimaryCategory(vendor.category) } as Partial<Vendor>).catch(console.error));
  }, [vendors.rows]);

  useEffect(() => {
    vendors.rows.filter(isContractedVendor).forEach((vendor) => {
      syncContractedVendor(vendor, true).catch((error) => console.log('[vendor-budget-sync] erro do Supabase', error));
    });
  }, [vendors.rows]);

  function start(row?: Vendor) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            name: row.name,
            category: toPrimaryCategory(row.category),
            contact_name: row.contact_name ?? '',
            phone: row.phone ?? '',
            email: row.email ?? '',
            instagram: row.instagram ?? '',
            site: row.site ?? '',
            contracted_value: row.contracted_value,
            paid_value: row.paid_value,
            due_date: row.due_date ?? '',
            status: normalizeVendorWorkflowStatus(row.status),
            contract_url: row.contract_url ?? '',
            notes: row.notes ?? ''
          }
        : blankVendor
    );
    setOpen(true);
  }

  async function createCategory(name: string) {
    if (categoryOptions.includes(name)) return;
    await customCategories.create({ name, sort_order: customCategories.rows.length + 1 } as Partial<BudgetCategory>);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      category: toPrimaryCategory(form.category),
      status: normalizeVendorWorkflowStatus(form.status),
      due_date: form.due_date || null,
      contract_url: form.contract_url || null
    };
    if (normalizeVendorWorkflowStatus(payload.status) === 'contratado' && (!editing || !isContractedVendor(editing))) {
      openPaymentModal({
        ...(editing ?? {}),
        ...payload,
        id: editing?.id ?? '',
        wedding_id: editing?.wedding_id ?? '',
        paid_value: Number(form.paid_value ?? 0)
      } as Vendor);
      return;
    }

    const saved = editing ? await vendors.update(editing.id, payload as Partial<Vendor>) : await vendors.create(payload as Partial<Vendor>);
    await syncContractedVendor(saved, true);
    setOpen(false);
  }

  async function changeStatus(vendor: Vendor, status: string, forceBudgetCreate = false) {
    if (normalizeVendorWorkflowStatus(status) === 'contratado' && !isContractedVendor(vendor)) {
      openPaymentModal(vendor);
      return;
    }

    const saved = await vendors.update(vendor.id, { status: normalizeVendorWorkflowStatus(status) } as Partial<Vendor>);
    await syncContractedVendor(saved, true, forceBudgetCreate);
  }

  async function confirmHiring(vendor: Vendor) {
    openPaymentModal({ ...vendor, ...form, category: toPrimaryCategory(form.category), due_date: form.due_date || null } as Vendor);
  }

  async function confirmPaymentPlan() {
    if (!paymentVendor) return;

    const total = Number(paymentVendor.contracted_value ?? 0);
    if (total <= 0) {
      setPaymentError('Informe um valor contratado maior que zero.');
      return;
    }

    if (!paymentPlan.due_date) {
      setPaymentError('Informe a data limite de pagamento.');
      return;
    }

    setPaymentError('');
    const firstDueDate = paymentPlan.due_date || paymentVendor.due_date || null;
    const vendorPayload = {
      name: paymentVendor.name,
      category: toPrimaryCategory(paymentVendor.category),
      contact_name: paymentVendor.contact_name ?? null,
      phone: paymentVendor.phone ?? null,
      email: paymentVendor.email ?? null,
      instagram: paymentVendor.instagram ?? null,
      site: paymentVendor.site ?? null,
      contracted_value: total,
      paid_value: Number(paymentVendor.paid_value ?? 0),
      status: 'contratado',
      due_date: firstDueDate,
      contract_url: paymentVendor.contract_url ?? null,
      notes: paymentVendor.notes ?? null
    } as Partial<Vendor>;

    const savedVendor = paymentVendor.id
      ? await vendors.update(paymentVendor.id, vendorPayload)
      : await vendors.create(vendorPayload);
    const savedBudgetItem = await syncContractedVendor(savedVendor, true, true);

    if (!savedBudgetItem) {
      setPaymentError('Não foi possível criar o item financeiro.');
      return;
    }

    await budgetItems.update(savedBudgetItem.id, {
      due_date: firstDueDate,
      payment_method: paymentPlan.payment_method || null,
      notes: [savedBudgetItem.notes, paymentPlan.notes].filter(Boolean).join('\n') || null
    } as Partial<BudgetItem>);

    setPaymentVendor(null);
    setOpen(false);
    setMessage(`${savedVendor.name} contratado. Financeiro e vencimentos foram sincronizados.`);
  }

  async function addFile(vendor: Vendor, url: string, kind: DocumentKind) {
    await files.create({
      name: `${kind} - ${vendor.name}`,
      category: kind,
      vendor_id: vendor.id,
      budget_item_id: null,
      file_url: url,
      notes: null,
      uploaded_by: null
    } as Partial<FileRecord>);
  }

  const selectedBudgetItems = editing ? budgetByVendor.get(editing.id) ?? [] : [];
  const selectedFiles = editing ? files.rows.filter((file) => file.vendor_id === editing.id) : [];
  const statusOptions = [{ label: 'Todos', value: '' }, ...statusColumns.map((item) => ({ label: item.label, value: item.key }))];
  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStatusFilter('');
    setFinanceFilter('');
  };
  const filterFields = (
    <>
      <label className="block">
        <span className="label">Buscar fornecedor</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-w-faint" size={18} />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, categoria..." />
        </div>
      </label>
      <FormSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} options={[{ label: 'Todas', value: '' }, ...categoryOptions.map((item) => ({ label: item, value: item }))]} />
      <FormSelect label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={statusOptions} />
      <FormSelect label="Financeiro" value={financeFilter} onChange={(event) => setFinanceFilter(event.target.value)} options={financeOptions} />
    </>
  );

  return (
    <div className="space-y-4 text-w-text">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-w-faint">CRM de Contratação</p>
          <h1 className="page-title mt-1">Fornecedores</h1>
          <p className="mt-1 text-sm text-w-muted">Pesquise, compare, negocie e acompanhe contratos do casamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-soft">
            <button type="button" className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${view === 'kanban' ? 'bg-w-text text-white' : 'text-w-muted hover:bg-w-surface hover:text-w-text'}`} onClick={() => setView('kanban')}>
              <LayoutGrid size={15} /> Kanban
            </button>
            <button type="button" className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${view === 'list' ? 'bg-w-text text-white' : 'text-w-muted hover:bg-w-surface hover:text-w-text'}`} onClick={() => setView('list')}>
              <List size={15} /> Lista
            </button>
          </div>
          <button className="btn-primary" onClick={() => start()}>
            <Plus size={16} /> Fornecedor
          </button>
        </div>
      </div>

      {message && <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]">{message}</div>}

      <section className="hidden rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-soft lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end lg:gap-3">
        {filterFields}
        <button type="button" className="btn-secondary h-12" onClick={clearFilters}>Limpar</button>
      </section>

      <div className="lg:hidden">
        <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={clearFilters} clearLabel="Limpar" gridClassName="grid-cols-1">
          {filterFields}
        </ResponsiveFilters>
      </div>

      {!vendors.rows.length ? (
        <section className="rounded-3xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center shadow-soft">
          <Handshake className="mx-auto text-w-faint" />
          <h2 className="mt-3 text-lg font-bold">Nenhum fornecedor cadastrado</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-w-muted">Comece adicionando fornecedores para comparar orçamentos, negociar e gerar o financeiro automaticamente.</p>
          <button className="btn-primary mt-4" onClick={() => start()}><Plus size={16} /> Adicionar fornecedor</button>
        </section>
      ) : view === 'kanban' ? (
        <section className="grid auto-cols-[minmax(300px,86vw)] grid-flow-col gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-3 xl:overflow-visible">
          {statusColumns.map((column) => {
            const columnRows = rows.filter((vendor) => normalizeVendorWorkflowStatus(vendor.status) === normalizeVendorWorkflowStatus(column.key));
            const total = columnRows.reduce((sum, vendor) => sum + Number(vendor.contracted_value ?? 0), 0);
            const isDragTarget = dragOverStatus === column.key;

            return (
              <div
                key={column.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStatus(column.key);
                }}
                onDragLeave={() => setDragOverStatus('')}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverStatus('');
                  const id = event.dataTransfer.getData('vendor-id');
                  const vendor = vendors.rows.find((item) => item.id === id);
                  if (!vendor) return;
                  const forceBudgetCreate = normalizeVendorWorkflowStatus(column.key) === 'contratado';
                  changeStatus(vendor, column.key, forceBudgetCreate);
                }}
                className={`card-hover-soft rounded-3xl border border-[#E5E7EB] bg-white p-3 shadow-soft ${isDragTarget ? 'bg-[#FFF1F5] ring-2 ring-[rgba(225,29,72,0.18)]' : ''}`}
                style={{ borderTop: `4px solid ${column.color}` }}
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: column.color }} />
                      <h2 className="truncate text-sm font-bold">{column.label}</h2>
                    </div>
                    <span className="rounded-full bg-w-surface px-2 py-0.5 text-xs font-bold text-w-muted">{columnRows.length}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-w-muted">{columnRows.length} fornecedores</p>
                  <p className="mt-1 text-sm font-bold text-w-text">{formatMoney(total)}</p>
                </div>

                <div className="space-y-3">
                  {columnRows.length ? columnRows.map((vendor) => {
                    const nextItem = (budgetByVendor.get(vendor.id) ?? []).sort((a, b) => String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31')))[0];
                    return (
                      <VendorCard
                        key={vendor.id}
                        vendor={vendor}
                        budgetItem={nextItem}
                        onOpen={() => start(vendor)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('vendor-id', vendor.id);
                        }}
                      />
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-4 text-center">
                      <p className="text-sm font-semibold text-w-muted">Nenhum fornecedor</p>
                      <button type="button" className="mt-2 text-sm font-bold text-w-rose hover:underline" onClick={() => start()}>
                        + Adicionar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-soft">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_0.9fr_0.9fr_0.9fr_1fr_48px] gap-3 border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 text-xs font-bold uppercase text-w-faint lg:grid">
            <span>Fornecedor</span>
            <span>Categoria</span>
            <span>Status</span>
            <span>Valor</span>
            <span>Pago</span>
            <span>Em aberto</span>
            <span>Vencimento</span>
            <span />
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {rows.map((vendor) => {
              const pending = getPendingValue(vendor.contracted_value, vendor.paid_value);
              const statusMeta = statusColumns.find((item) => normalizeVendorWorkflowStatus(item.key) === normalizeVendorWorkflowStatus(vendor.status));
              return (
                <button key={vendor.id} type="button" className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-[#FAFAFA] lg:grid-cols-[1.5fr_1fr_1fr_0.9fr_0.9fr_0.9fr_1fr_48px] lg:items-center lg:gap-3" onClick={() => start(vendor)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-w-text">{vendor.name}</p>
                    <p className="text-xs text-w-muted">{vendor.contact_name || vendor.phone || '-'}</p>
                  </div>
                  <p className="text-sm font-semibold text-w-muted">{toPrimaryCategory(vendor.category)}</p>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-w-surface px-2.5 py-1 text-xs font-bold text-w-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: statusMeta?.color ?? '#6B7280' }} />
                    {statusMeta?.label ?? vendor.status}
                  </span>
                  <p className="text-sm font-semibold">{formatMoney(vendor.contracted_value)}</p>
                  <p className="text-sm font-semibold text-[#22C55E]">{formatMoney(vendor.paid_value)}</p>
                  <p className="text-sm font-semibold text-[#F59E0B]">{formatMoney(pending)}</p>
                  <p className="text-sm font-semibold text-w-muted">{formatDate(vendor.due_date)}</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl text-w-muted"><MoreVertical size={16} /></span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Modal open={open} title={editing ? editing.name : 'Novo fornecedor'} onClose={() => setOpen(false)}>
        <form className="-m-5 flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[calc(92vh-80px)] sm:rounded-2xl" onSubmit={submit}>
          <div className="flex-1 space-y-4 overflow-y-auto bg-w-surface/40 p-5">
            <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-w-text">Dados do fornecedor</h3>
                <p className="mt-0.5 text-xs font-medium text-w-muted">Identificação, categoria e contato principal.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput label="Nome do fornecedor" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <CategorySelect value={form.category} options={categoryOptions} onChange={(value) => setForm({ ...form, category: value })} onCreate={createCategory} />
                <FormInput label="Contato" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
                <FormInput label="Telefone" value={form.phone} onChange={(event) => setForm({ ...form, phone: maskPhone(event.target.value) })} />
              </div>
            </section>

            <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-w-text">Contrato</h3>
                <p className="mt-0.5 text-xs font-medium text-w-muted">Valor total e status do fornecedor.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <CurrencyInput label="Valor total" value={form.contracted_value} onValueChange={(value) => setForm({ ...form, contracted_value: value })} />
                <FormSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={statusColumns.map((item) => ({ label: item.label, value: item.key }))} />
              </div>
            </section>

            {editing && <Timeline vendor={{ ...editing, ...form } as Vendor} budgetItems={selectedBudgetItems} />}

            <details className="rounded-2xl border border-w-border bg-white p-4 shadow-soft" open={Boolean(editing)}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Documentos
                <ChevronDown size={16} />
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-w-border-md p-4">
                  <p className="mb-2 text-sm font-semibold">Contrato PDF</p>
                  <FileUpload folder="contratos" onUploaded={(url) => setForm({ ...form, contract_url: url })} />
                  {form.contract_url && <a className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-w-rose" href={form.contract_url} target="_blank" rel="noreferrer"><FileText size={15} /> Abrir contrato</a>}
                </div>
                {editing && (['Comprovante', 'Orçamento', 'Foto'] as DocumentKind[]).map((kind) => (
                  <div key={kind} className="rounded-2xl border border-dashed border-w-border-md p-4">
                    <p className="mb-2 text-sm font-semibold">{kind}</p>
                    <FileUpload folder="fornecedores" label="Anexar" onUploaded={(url) => addFile(editing, url, kind)} />
                  </div>
                ))}
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {selectedFiles.map((file) => (
                    <a key={file.id} className="flex items-center justify-between rounded-xl bg-w-surface p-3 text-sm font-medium" href={file.file_url} target="_blank" rel="noreferrer">
                      <span className="flex items-center gap-2"><Paperclip size={15} /> {file.name}</span>
                      <LinkIcon size={14} />
                    </a>
                  ))}
                </div>
              )}
            </details>

            <details className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Mais detalhes
                <ChevronDown size={16} />
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormInput label="E-mail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <FormInput label="Instagram" value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} />
                <FormInput label="Site" value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} />
                <FormInput label="Vencimento principal" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
              </div>
              <div className="mt-4">
                <FormTextarea label="Observações" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>
              {editing && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {form.phone && <a className="btn-secondary" href={buildWhatsAppChatLink(form.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
                  {form.email && <a className="btn-secondary" href={`mailto:${form.email}`}><Mail size={15} /> E-mail</a>}
                  {form.site && <a className="btn-secondary" href={form.site} target="_blank" rel="noreferrer"><Upload size={15} /> Site</a>}
                </div>
              )}
            </details>
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-w-border bg-white p-4 sm:flex sm:justify-end">
            {editing && <button type="button" className="btn-secondary text-[#DC2626]" onClick={() => setDeleting(editing)}>Excluir</button>}
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            {editing && normalizeVendorWorkflowStatus(form.status) !== 'contratado' && <button type="button" className="btn-secondary border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" onClick={() => confirmHiring(editing)}><CheckCircle2 size={16} /> Contratar</button>}
            <button className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(paymentVendor)} title="Definir pagamento do fornecedor" onClose={() => setPaymentVendor(null)}>
        {paymentVendor && (
          <form className="-m-5 flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[calc(92vh-80px)] sm:rounded-2xl" onSubmit={(event) => { event.preventDefault(); confirmPaymentPlan(); }}>
            <div className="flex-1 space-y-4 overflow-y-auto bg-w-surface/40 p-5">
              <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
                <p className="text-sm font-semibold text-w-muted">Antes de concluir, defina como este fornecedor será pago.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-w-text">{paymentVendor.name}</p>
                    <p className="text-sm font-semibold text-w-muted">{toPrimaryCategory(paymentVendor.category)}</p>
                  </div>
                  <div className="rounded-2xl bg-w-surface px-4 py-3">
                    <p className="text-[10px] font-bold uppercase text-w-faint">Valor contratado</p>
                    <p className="text-xl font-bold text-w-text">{formatMoney(Number(paymentVendor.contracted_value ?? 0))}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-w-border bg-white p-4 shadow-soft">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormInput label="Vencimento" type="date" value={paymentPlan.due_date} onChange={(event) => setPaymentPlan({ ...paymentPlan, due_date: event.target.value })} required />
                  <CurrencyInput label="Valor total" value={Number(paymentVendor.contracted_value ?? 0)} onValueChange={() => undefined} />
                  <FormInput label="Forma de pagamento" value={paymentPlan.payment_method} onChange={(event) => setPaymentPlan({ ...paymentPlan, payment_method: event.target.value })} />
                </div>
                <div className="mt-4">
                  <FormTextarea label="Observações" value={paymentPlan.notes} onChange={(event) => setPaymentPlan({ ...paymentPlan, notes: event.target.value })} />
                </div>
              </section>

              {paymentError && <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm font-semibold text-[#B91C1C]">{paymentError}</div>}
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-w-border bg-white p-4">
              <button type="button" className="btn-secondary" onClick={() => setPaymentVendor(null)}>Cancelar</button>
              <button className="btn-primary">Concluir contratação</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir ${deleting?.name ?? 'este fornecedor'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await supabase.from('budget_items').delete().eq('wedding_id', deleting.wedding_id).eq('vendor_id', deleting.id);
          await vendors.remove(deleting.id);
          setDeleting(null);
          setOpen(false);
        }}
      />
    </div>
  );
}

