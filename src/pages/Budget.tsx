import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  DollarSign,
  Edit2,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Search,
  Trash2,
  WalletCards
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
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
import { getPaymentStatus, getPendingValue, isBudgetOverdue, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';

const blank = {
  name: '',
  category: 'Espaço',
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

const preferredTabs = ['Espaço', 'Buffet', 'Bebidas', 'Decoração', 'Foto e Vídeo', 'Música / DJ', 'Cerimonial', 'Roupas dos Noivos', 'Doces e Bolo', 'Outros'];
const paymentStatuses = ['pendente', 'pago parcialmente', 'pago', 'vencido', 'cancelado'];
const paymentBlank = { amount: 0, payment_date: new Date().toISOString().slice(0, 10), payment_method: '', receipt_url: '', notes: '' };

const statusStyles: Record<string, string> = {
  pendente: 'bg-[#E7E0D8] text-[#6F6760] ring-[#E7E0D8]',
  'pago parcialmente': 'bg-[#D4A373]/15 text-[#B07C45] ring-[#D4A373]/25',
  pago: 'bg-[#5F8D6D]/15 text-[#5F8D6D] ring-[#5F8D6D]/25',
  vencido: 'bg-[#C46A6A]/15 text-[#C46A6A] ring-[#C46A6A]/25',
  cancelado: 'bg-stone-100 text-stone-500 ring-stone-200'
};

function statusBadge(status: string) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusStyles[status] ?? 'bg-stone-100 text-stone-600 ring-stone-200'}`}>
      {status}
    </span>
  );
}

function isOverdue(item: BudgetItem) {
  return isBudgetOverdue(item);
}

function paymentPercent(item: BudgetItem) {
  const contracted = Number(item.contracted_value ?? 0);
  if (contracted <= 0) return 0;
  return Math.min(100, Math.round((Number(item.paid_value ?? 0) / contracted) * 100));
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-lg border border-[#E7E0D8] bg-white p-3 shadow-[0_10px_24px_rgba(58,43,39,0.045)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6760]">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-[#2D2A26]">{value}</p>
        </div>
        <span className={`rounded-lg p-1.5 ${tone}`}>{icon}</span>
      </div>
    </div>
  );
}

function MobileSummaryCard({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-lg border border-[#E7E0D8] bg-white p-2.5 shadow-[0_8px_18px_rgba(58,43,39,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6F6760]">{label}</p>
          <p className="mt-1 truncate text-base font-semibold text-[#2D2A26]">{value}</p>
        </div>
        <span className={`rounded-lg p-1.5 ${tone}`}>{icon}</span>
      </div>
    </div>
  );
}

function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')}k`;
  return formatMoney(value).replace(',00', '');
}

function BudgetEmptyState({ onVendors, onAdd }: { onVendors: () => void; onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-[#E7E0D8] bg-white px-4 py-6 text-center shadow-[0_10px_24px_rgba(58,43,39,0.04)] sm:px-6 sm:py-8">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#E7E0D8] text-[#6F6760] sm:h-11 sm:w-11">
        <Receipt size={18} />
      </span>
      <h3 className="mt-2 font-semibold text-[#2D2A26] sm:mt-3 sm:text-lg">Nenhum item financeiro encontrado</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-snug text-[#6F6760]">Contrate um fornecedor para gerar um item financeiro automaticamente ou adicione um gasto avulso.</p>
      <div className="mt-4 grid gap-2 sm:flex sm:justify-center">
        <button type="button" className="btn-primary h-9 bg-[#B76E79] px-3 sm:h-auto" onClick={onVendors}>
          <ExternalLink size={15} /> Ver fornecedores
        </button>
        <button type="button" className="btn-secondary h-9 border-[#E7E0D8] bg-white px-3 text-[#2D2A26] sm:h-auto" onClick={onAdd}>
          <Plus size={15} /> Adicionar gasto avulso
        </button>
      </div>
    </div>
  );
}

function IconButton({ title, children, onClick }: { title: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E0D8] bg-white text-[#2D2A26] transition hover:border-[#B76E79] hover:bg-[#FAF8F5]"
    >
      {children}
    </button>
  );
}

export default function Budget() {
  const params = useParams();
  const navigate = useNavigate();
  const { wedding } = useWedding();
  const initial = params.category ? categorySlugMap[params.category] ?? 'Outros' : 'Todos';
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const customCategories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const [active, setActive] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [paying, setPaying] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({ ...blank, category: initial });
  const [paymentForm, setPaymentForm] = useState(paymentBlank);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);

  const vendorById = useMemo(() => new Map(vendors.rows.map((item) => [item.id, item.name])), [vendors.rows]);

  useEffect(() => {
    items.rows
      .filter((item) => item.category !== toPrimaryCategory(item.category))
      .forEach((item) => {
        items.update(item.id, { category: toPrimaryCategory(item.category) } as Partial<BudgetItem>).catch(console.error);
      });
    vendors.rows
      .filter((vendorItem) => vendorItem.category !== toPrimaryCategory(vendorItem.category))
      .forEach((vendorItem) => {
        vendors.update(vendorItem.id, { category: toPrimaryCategory(vendorItem.category) } as Partial<Vendor>).catch(console.error);
      });
  }, [items.rows, vendors.rows]);

  const tabCategories = useMemo(() => {
    const categoriesWithData = items.rows.map((item) => toPrimaryCategory(item.category)).filter(Boolean);
    const custom = customCategories.rows
      .map((category) => category.name.trim())
      .filter((name) => name && toPrimaryCategory(name) === name);
    return Array.from(new Set(['Todos', ...preferredTabs, ...budgetCategories, ...custom, ...categoriesWithData]));
  }, [items.rows]);

  const categoryTotals = useMemo(
    () =>
      items.rows.reduce<Record<string, number>>((acc, item) => {
        const primary = toPrimaryCategory(item.category);
        acc[primary] = (acc[primary] ?? 0) + Number(item.contracted_value ?? 0);
        return acc;
      }, {}),
    [items.rows]
  );

  const filteredRows = useMemo(() => {
    const now = new Date();
    const inSeven = new Date(now);
    inSeven.setDate(now.getDate() + 7);
    const inThirty = new Date(now);
    inThirty.setDate(now.getDate() + 30);

    return items.rows.filter((item) => {
      const due = item.due_date ? new Date(`${item.due_date}T12:00:00`) : null;
      const matchDue =
        !dueFilter ||
        (dueFilter === 'overdue' && isOverdue(item)) ||
        (dueFilter === 'next7' && due && due >= now && due <= inSeven) ||
        (dueFilter === 'next30' && due && due >= now && due <= inThirty) ||
        (dueFilter === 'no_due' && !due);

      return (
        (active === 'Todos' || toPrimaryCategory(item.category) === active) &&
        item.name.toLowerCase().includes(search.toLowerCase()) &&
        (!status || item.payment_status === status) &&
        (!vendor || item.vendor_id === vendor) &&
        matchDue
      );
    });
  }, [active, dueFilter, items.rows, search, status, vendor]);

  const allTotals = useMemo(() => {
    const contracted = items.rows.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0);
    const paid = items.rows.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0);
    const contractedVendors = vendors.rows.filter((vendor) => vendor.status === 'contratado').length;
    return {
      planned: Number(wedding?.planned_budget ?? 0),
      contracted,
      paid,
      pending: Math.max(0, contracted - paid),
      overdue: items.rows.filter(isOverdue).length,
      contractedVendors
    };
  }, [items.rows, vendors.rows, wedding?.planned_budget]);

  const activeFilterCount = useMemo(
    () => [search.trim(), status, vendor, dueFilter].filter(Boolean).length,
    [dueFilter, search, status, vendor]
  );

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
        : { ...blank, category: active === 'Todos' ? 'Espaço' : active }
    );
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      category: toPrimaryCategory(form.category),
      vendor_id: form.vendor_id || null,
      receipt_url: form.receipt_url || null,
      payment_status: getPaymentStatus(form.contracted_value, form.paid_value)
    };
    if (editing) await items.update(editing.id, payload as Partial<BudgetItem>);
    else await items.create(payload as Partial<BudgetItem>);
    setOpen(false);
  }

  function startPayment(item: BudgetItem) {
    setPaying(item);
    setPaymentForm(paymentBlank);
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!paying) return;

    const nextPaid = Number(paying.paid_value ?? 0) + Number(paymentForm.amount ?? 0);
    const nextStatus = getPaymentStatus(Number(paying.contracted_value ?? 0), nextPaid);
    const nextReceipt = paymentForm.receipt_url || paying.receipt_url;
    const nextNotes = [paying.notes, paymentForm.notes].filter(Boolean).join('\n');

    await items.update(paying.id, {
      paid_value: nextPaid,
      payment_status: nextStatus,
      payment_date: paymentForm.payment_date || new Date().toISOString().slice(0, 10),
      payment_method: paymentForm.payment_method || paying.payment_method,
      receipt_url: nextReceipt,
      notes: nextNotes
    } as Partial<BudgetItem>);

    if (paying.vendor_id) {
      await vendors.update(paying.vendor_id, {
        paid_value: nextPaid,
        due_date: paying.due_date
      } as Partial<Vendor>);
    }

    setMessage(`Pagamento registrado para ${paying.name}.`);
    setPaying(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await items.remove(deleting.id);
    setDeleting(null);
  }

  function clearFilters() {
    setActive('Todos');
    setSearch('');
    setStatus('');
    setVendor('');
    setDueFilter('');
  }

  function renderExpenseCard(item: BudgetItem) {
    const percent = paymentPercent(item);
    const pending = getPendingValue(item.contracted_value, item.paid_value);
    return (
      <article key={item.id} className="rounded-lg border border-[#E7E0D8] bg-white px-4 py-2.5 shadow-[0_14px_32px_rgba(58,43,39,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(58,43,39,0.09)]">
        <div className="space-y-2.5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#B76E79]/18 px-2.5 py-1 text-xs font-semibold text-[#B76E79]">{toPrimaryCategory(item.category)}</span>
              {statusBadge(isOverdue(item) ? 'vencido' : item.payment_status)}
            </div>
            <div className="grid gap-x-3 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-4 lg:text-right">
              <div className="whitespace-nowrap"><span className="text-[11px] text-[#6F6760]">Contratado: </span><strong className="text-[#2D2A26]">{formatMoney(item.contracted_value)}</strong></div>
              <div className="whitespace-nowrap"><span className="text-[11px] text-[#6F6760]">Pago: </span><strong className="text-[#5F8D6D]">{formatMoney(item.paid_value)}</strong></div>
              <div className="whitespace-nowrap"><span className="text-[11px] text-[#6F6760]">Pendente: </span><strong className="text-[#B07C45]">{formatMoney(pending)}</strong></div>
              <div className="whitespace-nowrap"><span className="text-[11px] text-[#6F6760]">Vencimento: </span><strong className={isOverdue(item) ? 'text-[#C46A6A]' : 'text-[#2D2A26]'}>{formatDate(item.due_date)}</strong></div>
            </div>
          </div>

          <div className="min-w-0">
            <button type="button" className="line-clamp-1 text-left text-base font-semibold leading-snug text-[#2D2A26] hover:text-[#B76E79] sm:text-lg" onClick={() => start(item)}>
              {item.name}
            </button>
            <p className="mt-0.5 line-clamp-1 text-sm text-[#6F6760]">Fornecedor: {vendorById.get(item.vendor_id ?? '') ?? '-'}</p>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[minmax(260px,640px)_auto] lg:items-end lg:justify-between">
            <div className="w-full max-w-[640px]">
              <div className="text-xs font-medium text-[#6F6760]">
                Progresso do pagamento · <span className="font-semibold text-[#2D2A26]">{percent}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E7E0D8]">
                <div className="h-full rounded-full bg-[#5F8D6D]" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <button type="button" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#5F8D6D]/30 bg-[#5F8D6D]/10 px-2.5 text-xs font-medium text-[#5F8D6D] transition hover:bg-[#5F8D6D]/15" onClick={() => startPayment(item)} title="Registrar pagamento">
                <DollarSign size={15} /> Registrar pagamento
              </button>
              <FileUpload folder="comprovantes" compact label="Anexar" onUploaded={(url) => items.update(item.id, { receipt_url: url } as Partial<BudgetItem>)} />
              {item.receipt_url && (
                <a
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E0D8] bg-white text-[#2D2A26] transition hover:border-[#B76E79] hover:bg-[#FAF8F5]"
                  href={item.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir comprovante"
                  aria-label="Abrir comprovante"
                >
                  <FileText size={15} />
                </a>
              )}
              <IconButton title="Editar financeiro" onClick={() => start(item)}>
                <Edit2 size={15} />
              </IconButton>
              <IconButton title="Excluir gasto" onClick={() => setDeleting(item)}>
                <Trash2 size={15} className="text-[#C46A6A]" />
              </IconButton>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const formPending = getPendingValue(form.contracted_value, form.paid_value);

  const resultText = useMemo(() => {
    const count = filteredRows.length;
    if (status) return `Mostrando ${count} ${count === 1 ? 'pagamento' : 'pagamentos'} ${status}`;
    if (active !== 'Todos') return `Mostrando ${count} ${count === 1 ? 'gasto' : 'gastos'} em ${active}`;
    return `Mostrando ${count} ${count === 1 ? 'gasto' : 'gastos'}`;
  }, [active, filteredRows.length, status]);

  return (
    <div className="space-y-3 text-[#2D2A26] sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h1 className="page-title text-[#2D2A26]">Financeiro</h1>
          <p className="mt-1 text-sm text-[#6F6760]">Controle de contratos, pagamentos e vencimentos do casamento.</p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-wrap">
          <button className="btn-primary h-9 bg-[#B76E79] px-3 sm:h-auto sm:px-4" onClick={() => navigate('/fornecedores')}>
            <ExternalLink size={16} /> Ver fornecedores
          </button>
          <div className="relative">
            <button className="btn-secondary h-9 border-[#E7E0D8] bg-white px-3 text-[#2D2A26] sm:h-auto" onClick={() => setActionsOpen((current) => !current)}>
              <MoreHorizontal size={16} />
              <span>Mais ações</span>
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-[#E7E0D8] bg-white p-1.5 shadow-[0_18px_45px_rgba(92,64,51,0.12)]">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#2D2A26] transition hover:bg-[#FAF8F5]" onClick={() => { setActionsOpen(false); navigate('/orcamento/vencimentos'); }}>
                  <CalendarClock size={16} /> Ver vencimentos
                </button>
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#2D2A26] transition hover:bg-[#FAF8F5]" onClick={() => { setActionsOpen(false); start(); }}>
                  <Plus size={16} /> Adicionar gasto avulso
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-[#5F8D6D]/25 bg-[#5F8D6D]/12 p-3 text-sm text-[#5F8D6D]">{message}</div>}

      <section className="grid grid-cols-2 gap-2 sm:hidden">
        <MobileSummaryCard label="Contratado" value={compactMoney(allTotals.contracted)} icon={<WalletCards size={15} />} tone="bg-[#B76E79]/20 text-[#B76E79]" />
        <MobileSummaryCard label="Pago" value={compactMoney(allTotals.paid)} icon={<CheckCircle2 size={15} />} tone="bg-[#5F8D6D]/15 text-[#5F8D6D]" />
        <MobileSummaryCard label="Pendente" value={compactMoney(allTotals.pending)} icon={<CalendarClock size={15} />} tone="bg-[#D4A373]/15 text-[#B07C45]" />
        <MobileSummaryCard label="Vencidos" value={allTotals.overdue} icon={<AlertTriangle size={15} />} tone="bg-[#C46A6A]/15 text-[#C46A6A]" />
        <p className="col-span-2 text-xs text-[#6F6760]">Fornecedores contratados: <strong className="text-[#2D2A26]">{allTotals.contractedVendors}</strong></p>
      </section>

      <section className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Contratado" value={formatMoney(allTotals.contracted)} icon={<WalletCards size={16} />} tone="bg-[#B76E79]/20 text-[#B76E79]" />
        <SummaryCard label="Pago" value={formatMoney(allTotals.paid)} icon={<CheckCircle2 size={16} />} tone="bg-[#5F8D6D]/15 text-[#5F8D6D]" />
        <SummaryCard label="Pendente" value={formatMoney(allTotals.pending)} icon={<CalendarClock size={16} />} tone="bg-[#D4A373]/15 text-[#B07C45]" />
        <SummaryCard label="Vencidos" value={allTotals.overdue} icon={<AlertTriangle size={16} />} tone="bg-[#C46A6A]/15 text-[#C46A6A]" />
        <p className="sm:col-span-2 lg:col-span-4 text-xs text-[#6F6760]">Fornecedores contratados: <strong className="text-[#2D2A26]">{allTotals.contractedVendors}</strong></p>
      </section>

      <section className="rounded-lg border border-[#E7E0D8] bg-white px-2 py-1.5 shadow-[0_8px_18px_rgba(58,43,39,0.04)] sm:py-2 sm:shadow-[0_12px_28px_rgba(58,43,39,0.05)]">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#E7E0D8] bg-[#FAF8F5] text-[#6F6760] transition hover:border-[#B76E79] hover:text-[#2D2A26] sm:inline-flex"
            onClick={() => document.getElementById('budget-category-scroll')?.scrollBy({ left: -260, behavior: 'smooth' })}
            aria-label="Rolar categorias para esquerda"
          >
            <ChevronLeft size={16} />
          </button>
          <div id="budget-category-scroll" className="flex scroll-smooth gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] sm:gap-2 sm:py-1 [&::-webkit-scrollbar]:hidden">
            {tabCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-left transition sm:px-3 sm:py-1.5 ${
                  active === category ? 'border-[#B76E79] bg-[#B76E79] text-white shadow-sm' : 'border-[#E7E0D8] bg-[#FAF8F5] text-[#2D2A26] hover:border-[#B76E79]'
                }`}
              >
                <span className="whitespace-nowrap text-xs font-semibold leading-4">
                  {category}
                  {(category === 'Todos' ? allTotals.contracted : categoryTotals[category] ?? 0) > 0 && (
                    <>
                      <span className={active === category ? 'text-white/60' : 'text-[#6F6760]'}> · </span>
                      <span className={active === category ? 'text-white/80' : 'text-[#6F6760]'}>
                        <span className="sm:hidden">{compactMoney(category === 'Todos' ? allTotals.contracted : categoryTotals[category] ?? 0)}</span>
                        <span className="hidden sm:inline">{compactMoney(category === 'Todos' ? allTotals.contracted : categoryTotals[category] ?? 0)}</span>
                      </span>
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#E7E0D8] bg-[#FAF8F5] text-[#6F6760] transition hover:border-[#B76E79] hover:text-[#2D2A26] sm:inline-flex"
            onClick={() => document.getElementById('budget-category-scroll')?.scrollBy({ left: 260, behavior: 'smooth' })}
            aria-label="Rolar categorias para direita"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <ResponsiveFilters
        activeFiltersCount={activeFilterCount}
        onClearFilters={clearFilters}
        className="p-2.5 sm:p-3 [&_select.input]:h-9 [&_select.input]:text-sm"
        gridClassName="lg:grid-cols-[1.6fr_0.9fr_1fr_0.95fr_auto]"
        footer={
          <p className="mt-1.5 text-sm text-[#6F6760] sm:mt-2">
            {resultText}
          </p>
        }
      >
          <label className="block">
            <span className="label text-[#6F6760]">Buscar gasto</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B76E79]" size={18} />
              <input
                className="input h-9 border-[#E7E0D8] bg-[#FAF8F5] pl-10 text-sm text-[#2D2A26] placeholder:text-[#6F6760]/60 focus:border-[#B76E79] focus:ring-[#B76E79]/20"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do gasto"
              />
            </div>
          </label>
          <FormSelect label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: 'Todos', value: '' }, ...paymentStatuses.map((value) => ({ label: value, value }))]} />
          <FormSelect label="Fornecedor" value={vendor} onChange={(event) => setVendor(event.target.value)} options={[{ label: 'Todos', value: '' }, ...vendors.rows.map((item) => ({ label: item.name, value: item.id }))]} />
          <FormSelect
            label="Vencimento"
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
            options={[
              { label: 'Todos', value: '' },
              { label: 'Vencidos', value: 'overdue' },
              { label: 'Próximos 7 dias', value: 'next7' },
              { label: 'Próximos 30 dias', value: 'next30' },
              { label: 'Sem vencimento', value: 'no_due' }
            ]}
          />
      </ResponsiveFilters>

      {filteredRows.some(isOverdue) && (
        <div className="flex items-center gap-2 rounded-lg border border-[#C46A6A]/20 bg-[#C46A6A]/10 p-3 text-sm text-[#C46A6A]">
          <AlertTriangle size={16} />
          Há pagamentos vencidos {active === 'Todos' ? 'nos itens filtrados' : 'nesta categoria'}.
        </div>
      )}

      <section className="grid gap-3">
        {filteredRows.length ? filteredRows.map(renderExpenseCard) : <BudgetEmptyState onVendors={() => navigate('/fornecedores')} onAdd={() => start()} />}
      </section>

      <Modal open={open} title={editing ? 'Editar financeiro' : 'Adicionar gasto avulso'} onClose={() => setOpen(false)}>
        <form className="-m-5 flex max-h-[calc(92vh-73px)] flex-col" onSubmit={submit}>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <section className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-4">
              <h3 className="text-sm font-semibold text-[#2D2A26]">Dados principais</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormInput label="Nome do gasto" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <FormSelect label="Categoria" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={tabCategories.map((value) => ({ label: value, value }))} />
              </div>
              <div className="mt-4">
                <FormTextarea label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
            </section>

            <section className="rounded-lg border border-[#E7E0D8] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#2D2A26]">Valores</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-3">
                  <CurrencyInput label="Valor estimado" value={form.estimated_value} onValueChange={(value) => setForm({ ...form, estimated_value: value })} />
                </div>
                <div className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-3">
                  <CurrencyInput label="Valor contratado" value={form.contracted_value} onValueChange={(value) => setForm({ ...form, contracted_value: value })} />
                </div>
                <div className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-3">
                  <CurrencyInput label="Valor pago" value={form.paid_value} onValueChange={(value) => setForm({ ...form, paid_value: value })} />
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-[#D4A373]/25 bg-[#D4A373]/10 p-3 text-sm text-[#6F6760]">
                Valor pendente calculado: <strong className="text-[#2D2A26]">{formatMoney(formPending)}</strong>
              </div>
            </section>

            <section className="rounded-lg border border-[#E7E0D8] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#2D2A26]">Pagamento</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormSelect label="Status" value={form.payment_status} onChange={(event) => setForm({ ...form, payment_status: event.target.value })} options={paymentStatuses.map((value) => ({ label: value, value }))} />
                <FormSelect label="Fornecedor relacionado" value={form.vendor_id} onChange={(event) => setForm({ ...form, vendor_id: event.target.value })} options={[{ label: 'Nenhum', value: '' }, ...vendors.rows.map((item) => ({ label: item.name, value: item.id }))]} />
                <FormInput label="Vencimento" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                <FormInput label="Data de pagamento" type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
                <FormInput label="Forma de pagamento" value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} />
              </div>
            </section>

            <section className="rounded-lg border border-[#E7E0D8] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#2D2A26]">Arquivos e observações</h3>
              <div className="mt-4 rounded-lg border border-dashed border-[#B76E79] bg-[#FAF8F5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2D2A26]">Comprovante de pagamento</p>
                    <p className="text-xs text-[#6F6760]">Anexe recibos, notas ou comprovantes relacionados a este gasto.</p>
                  </div>
                  <FileUpload folder="comprovantes" onUploaded={(url) => setForm({ ...form, receipt_url: url })} />
                </div>
                {form.receipt_url && (
                  <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#5F8D6D] hover:underline" href={form.receipt_url} target="_blank" rel="noreferrer">
                    <FileText size={15} /> Ver comprovante anexado
                  </a>
                )}
              </div>
              <div className="mt-4">
                <FormTextarea label="observações" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[#E7E0D8] bg-white px-5 py-4">
            <button type="button" className="btn-secondary border-[#E7E0D8] bg-white text-[#2D2A26]" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary bg-[#B76E79]">Salvar gasto</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(paying)} title="Registrar pagamento" onClose={() => setPaying(null)}>
        {paying && (
          <form className="-m-5 flex max-h-[calc(92vh-73px)] flex-col" onSubmit={submitPayment}>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-4">
                <p className="text-sm text-[#6F6760]">Item financeiro</p>
                <h3 className="mt-1 text-lg font-semibold text-[#2D2A26]">{paying.name}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-[#6F6760]">Contratado</p><p className="font-semibold">{formatMoney(paying.contracted_value)}</p></div>
                  <div><p className="text-xs text-[#6F6760]">Pago atual</p><p className="font-semibold text-[#5F8D6D]">{formatMoney(paying.paid_value)}</p></div>
                  <div><p className="text-xs text-[#6F6760]">Pendente atual</p><p className="font-semibold text-[#B07C45]">{formatMoney(getPendingValue(paying.contracted_value, paying.paid_value))}</p></div>
                </div>
              </section>

              <section className="rounded-lg border border-[#E7E0D8] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#2D2A26]">Dados do pagamento</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-3">
                    <CurrencyInput label="Valor do pagamento" value={paymentForm.amount} onValueChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} />
                  </div>
                  <FormInput label="Data do pagamento" type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} />
                  <FormInput label="Forma de pagamento" value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })} />
                </div>
              </section>

              <section className="rounded-lg border border-[#E7E0D8] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#2D2A26]">Comprovante e observação</h3>
                <div className="mt-4 rounded-lg border border-dashed border-[#B76E79] bg-[#FAF8F5] p-4">
                  <FileUpload folder="comprovantes" onUploaded={(url) => setPaymentForm({ ...paymentForm, receipt_url: url })} />
                  {paymentForm.receipt_url && <a className="ml-3 text-sm font-medium text-[#5F8D6D] hover:underline" href={paymentForm.receipt_url} target="_blank" rel="noreferrer">Comprovante anexado</a>}
                </div>
                <div className="mt-4">
                  <FormTextarea label="Observação" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[#E7E0D8] bg-white px-5 py-4">
              <button type="button" className="btn-secondary border-[#E7E0D8] bg-white text-[#2D2A26]" onClick={() => setPaying(null)}>
                Cancelar
              </button>
              <button className="btn-primary bg-[#B76E79]" disabled={paymentForm.amount <= 0}>Salvar pagamento</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir gasto"
        message={`Tem certeza que deseja excluir ${deleting?.name ?? 'este gasto'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}


