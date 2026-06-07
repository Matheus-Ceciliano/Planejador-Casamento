import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileText,
  Handshake,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Trash2,
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
import { BudgetCategory, BudgetItem, FileRecord, Vendor } from '../types';
import { vendorCategories } from '../utils/constants';
import { getPaymentStatus, getPendingValue, isContractedVendor, normalizeVendorStatus, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';
import { syncVendorBudgetItem } from '../utils/vendorBudgetSync';
import { buildWhatsAppChatLink } from '../utils/whatsappService';

const statusColumns = [
  { key: 'pesquisando', label: 'Pesquisando', dot: 'bg-[#EAB308]', tint: 'bg-[#FEFCE8]', ring: 'border-[#FDE68A]' },
  { key: 'orçamento recebido', label: 'Orçamentos', dot: 'bg-[#F97316]', tint: 'bg-[#FFF7ED]', ring: 'border-[#FED7AA]' },
  { key: 'em negociação', label: 'Negociação', dot: 'bg-[#2563EB]', tint: 'bg-[#EFF6FF]', ring: 'border-[#BFDBFE]' },
  { key: 'contratado', label: 'Contratados', dot: 'bg-[#16A34A]', tint: 'bg-[#F0FDF4]', ring: 'border-[#BBF7D0]' },
  { key: 'cancelado', label: 'Cancelados', dot: 'bg-[#27272A]', tint: 'bg-[#F4F4F5]', ring: 'border-[#D4D4D8]' }
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

const blankInstallment = {
  label: 'Entrada',
  amount: 0,
  due_date: new Date().toISOString().slice(0, 10)
};

type VendorForm = typeof blankVendor;
type InstallmentForm = typeof blankInstallment;
type DocumentKind = 'Contrato PDF' | 'Comprovante' | 'Orçamento' | 'Foto';

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
  const hasInstallments = Boolean(budgetItem && budgetItem.name !== vendor.name);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl border border-[#ECE7E1] bg-white p-4 shadow-[0_14px_36px_rgba(24,24,27,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(24,24,27,0.10)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-w-text">{vendor.name}</h3>
          <p className="mt-1 text-xs font-medium text-w-muted">{toPrimaryCategory(vendor.category)}</p>
        </div>
        <span className="rounded-full bg-w-surface px-2.5 py-1 text-[11px] font-bold capitalize text-w-muted">{vendor.status}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-w-faint">Valor</p>
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

      <div className="mt-4 rounded-xl bg-[#FAFAFA] p-3">
        <p className="text-[10px] font-bold uppercase text-w-faint">Próximo vencimento</p>
        <p className="mt-1 text-sm font-semibold text-w-text">{formatDate(nextDue ?? null)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {vendor.contract_url && <span className="badge-muted">Contrato</span>}
        {hasInstallments && <span className="badge-gold">Parcelado</span>}
        {budgetItem && <span className="badge-green">No orçamento</span>}
      </div>
    </article>
  );
}

function Timeline({ vendor, budgetItems }: { vendor: Vendor; budgetItems: BudgetItem[] }) {
  const hasBudget = budgetItems.length > 0;
  const normalizedStatus = normalizeVendorStatus(vendor.status);
  const hasQuote = normalizedStatus !== 'pesquisando';
  const meetingDone = ['em negociacao', 'contratado'].includes(normalizedStatus);
  const hasContract = normalizedStatus === 'contratado';
  const nextPayment = budgetItems
    .filter((item) => getPendingValue(item.contracted_value, item.paid_value) > 0 && item.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];

  const steps = [
    { label: 'Primeiro contato', done: true },
    { label: 'Orçamento recebido', done: hasQuote },
    { label: 'Reunião realizada', done: meetingDone },
    { label: 'Contratação', done: hasContract || hasBudget },
    { label: nextPayment ? `Próxima parcela: ${formatDate(nextPayment.due_date)}` : 'Próxima parcela', done: false }
  ];

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
    </div>
  );
}

export default function Vendors() {
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const customCategories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const files = useWeddingTable<FileRecord>('files', 'created_at');
  const [form, setForm] = useState<VendorForm>(blankVendor);
  const [installments, setInstallments] = useState<InstallmentForm[]>([{ ...blankInstallment }]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
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
      vendors.rows.filter(
        (vendor) =>
          `${vendor.name} ${vendor.phone ?? ''} ${vendor.category}`.toLowerCase().includes(search.toLowerCase()) &&
          (!category || toPrimaryCategory(vendor.category) === category)
      ),
    [category, search, vendors.rows]
  );

  const activeFilterCount = [search.trim(), category].filter(Boolean).length;

  function existingBudgetItemsFor(vendorId: string) {
    return budgetByVendor.get(vendorId) ?? [];
  }

  async function syncContractedVendor(vendor: Vendor, debug = false) {
    if (!isContractedVendor(vendor)) return;
    if (syncInFlight.current.has(vendor.id)) return;

    syncInFlight.current.add(vendor.id);
    try {
      await syncVendorBudgetItem(vendor, existingBudgetItemsFor(vendor.id), budgetItems, { debug });
    } finally {
      syncInFlight.current.delete(vendor.id);
    }
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
  }, [vendors.rows, budgetItems.rows]);

  function start(row?: Vendor) {
    setEditing(row ?? null);
    setInstallments([{ ...blankInstallment, amount: Number(row?.contracted_value ?? 0) }]);
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
            status: row.status,
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
      status: normalizeVendorStatus(form.status),
      due_date: form.due_date || null,
      contract_url: form.contract_url || null
    };
    const saved = editing ? await vendors.update(editing.id, payload as Partial<Vendor>) : await vendors.create(payload as Partial<Vendor>);
    await syncContractedVendor(saved, true);
    setOpen(false);
  }

  async function changeStatus(vendor: Vendor, status: string) {
    const saved = await vendors.update(vendor.id, { status: normalizeVendorStatus(status) } as Partial<Vendor>);
    await syncContractedVendor(saved, true);
  }

  async function confirmHiring(vendor: Vendor) {
    const saved = await vendors.update(vendor.id, {
      ...form,
      status: 'contratado',
      category: toPrimaryCategory(form.category),
      due_date: form.due_date || null
    } as Partial<Vendor>);

    await syncContractedVendor(saved, true);

    setMessage(`${vendor.name} contratado. Financeiro, gráficos, vencimentos e agenda foram sincronizados.`);
    setOpen(false);
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

  return (
    <div className="space-y-5 text-w-text">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-w-faint">CRM de contratação</p>
          <h1 className="page-title mt-1">Fornecedores</h1>
          <p className="mt-1 text-sm text-w-muted">Pesquise, negocie, contrate e gere financeiro sem cadastro duplicado.</p>
        </div>
        <button className="btn-primary" onClick={() => start()}>
          <Plus size={16} /> Fornecedor
        </button>
      </div>

      {message && <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]">{message}</div>}

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={() => { setSearch(''); setCategory(''); }} clearLabel="Limpar" gridClassName="lg:grid-cols-[1.4fr_1fr_auto]">
        <label className="block">
          <span className="label">Busca global</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-w-faint" size={18} />
            <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fotógrafo, buffet, contrato, parcela..." />
          </div>
        </label>
        <FormSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} options={[{ label: 'Todas', value: '' }, ...categoryOptions.map((item) => ({ label: item, value: item }))]} />
      </ResponsiveFilters>

      <section className="grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
        {statusColumns.map((column) => {
          const columnRows = rows.filter((vendor) => normalizeVendorStatus(vendor.status) === normalizeVendorStatus(column.key));
          return (
            <div
              key={column.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData('vendor-id');
                const vendor = vendors.rows.find((item) => item.id === id);
                if (vendor) changeStatus(vendor, column.key);
              }}
              className={`min-h-[420px] rounded-3xl border ${column.ring} ${column.tint} p-3`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                  <h2 className="text-sm font-bold">{column.label}</h2>
                </div>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-w-muted">{columnRows.length}</span>
              </div>
              <div className="space-y-3">
                {columnRows.map((vendor) => {
                  const nextItem = (budgetByVendor.get(vendor.id) ?? []).sort((a, b) => String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31')))[0];
                  return (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      budgetItem={nextItem}
                      onOpen={() => start(vendor)}
                      onDragStart={(event) => event.dataTransfer.setData('vendor-id', vendor.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <Modal open={open} title={editing ? editing.name : 'Novo fornecedor'} onClose={() => setOpen(false)}>
        <form className="-m-5 flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[calc(92vh-80px)] sm:rounded-2xl" onSubmit={submit}>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <section className="glass rounded-3xl p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput label="Nome do fornecedor" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <CategorySelect value={form.category} options={categoryOptions} onChange={(value) => setForm({ ...form, category: value })} onCreate={createCategory} />
                <FormInput label="Contato" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
                <FormInput label="Telefone" value={form.phone} onChange={(event) => setForm({ ...form, phone: maskPhone(event.target.value) })} />
                <CurrencyInput label="Valor total" value={form.contracted_value} onValueChange={(value) => setForm({ ...form, contracted_value: value })} />
                <FormSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={statusColumns.map((item) => ({ label: item.label, value: item.key }))} />
              </div>
            </section>

            {editing && <Timeline vendor={{ ...editing, ...form } as Vendor} budgetItems={selectedBudgetItems} />}

            <details className="rounded-2xl border border-w-border bg-white p-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Parcelas
                <ChevronDown size={16} />
              </summary>
              <div className="mt-4 space-y-3">
                {installments.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl bg-w-surface p-3 md:grid-cols-[1fr_1fr_160px_auto]">
                    <FormInput label="Nome" value={item.label} onChange={(event) => setInstallments((current) => current.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} />
                    <CurrencyInput label="Valor" value={item.amount} onValueChange={(value) => setInstallments((current) => current.map((row, i) => i === index ? { ...row, amount: value } : row))} />
                    <FormInput label="Vencimento" type="date" value={item.due_date} onChange={(event) => setInstallments((current) => current.map((row, i) => i === index ? { ...row, due_date: event.target.value } : row))} />
                    <button type="button" className="btn-secondary self-end px-3" onClick={() => setInstallments((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={() => setInstallments((current) => [...current, { label: `Parcela ${current.length + 1}`, amount: 0, due_date: '' }])}>
                  <Plus size={15} /> Adicionar parcela
                </button>
              </div>
            </details>

            <details className="rounded-2xl border border-w-border bg-white p-4" open={Boolean(editing)}>
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

            <details className="rounded-2xl border border-w-border bg-white p-4">
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
            {editing && normalizeVendorStatus(form.status) !== 'contratado' && <button type="button" className="btn-secondary border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" onClick={() => confirmHiring(editing)}><CheckCircle2 size={16} /> Contratar</button>}
            <button className="btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir ${deleting?.name ?? 'este fornecedor'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await vendors.remove(deleting.id);
          setDeleting(null);
          setOpen(false);
        }}
      />
    </div>
  );
}
