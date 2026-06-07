import { CheckCircle2, ChevronDown, Edit2, ExternalLink, Handshake, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import CurrencyInput from '../components/CurrencyInput';
import EmptyState from '../components/EmptyState';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetCategory, BudgetItem, Vendor } from '../types';
import { vendorCategories } from '../utils/constants';
import { categoryToBudgetSlug, getPaymentStatus, getPendingValue, toPrimaryCategory, vendorToBudgetPayload } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';
import { buildWhatsAppChatLink } from '../utils/whatsappService';

const blank = {
  name: '',
  category: 'Espaço',
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

const vendorStatuses = ['pesquisando', 'orçamento recebido', 'em negociação', 'contratado', 'cancelado'];
const editableVendorStatuses = vendorStatuses.filter((status) => status !== 'contratado');

const vendorStatusStyles: Record<string, string> = {
  pesquisando: 'bg-[#E7E0D8] text-[#6F6760] ring-[#E7E0D8]',
  'orçamento recebido': 'bg-[#B76E79]/18 text-[#B76E79] ring-[#B76E79]/30',
  'em negociação': 'bg-[#D4A373]/15 text-[#B07C45] ring-[#D4A373]/25',
  contratado: 'bg-[#5F8D6D]/15 text-[#5F8D6D] ring-[#5F8D6D]/25',
  cancelado: 'bg-[#C46A6A]/15 text-[#C46A6A] ring-[#C46A6A]/25'
};

const paymentStatusStyles: Record<string, string> = {
  pendente: 'bg-[#E7E0D8] text-[#6F6760] ring-[#E7E0D8]',
  'pago parcialmente': 'bg-[#D4A373]/15 text-[#B07C45] ring-[#D4A373]/25',
  pago: 'bg-[#5F8D6D]/15 text-[#5F8D6D] ring-[#5F8D6D]/25',
  vencido: 'bg-[#C46A6A]/15 text-[#C46A6A] ring-[#C46A6A]/25'
};

function Badge({ value, type = 'vendor' }: { value: string; type?: 'vendor' | 'payment' }) {
  const styles = type === 'vendor' ? vendorStatusStyles : paymentStatusStyles;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${styles[value] ?? 'bg-stone-100 text-stone-600 ring-stone-200'}`}>{value}</span>;
}

function isVendorOverdue(vendor: Vendor) {
  return Boolean(vendor.due_date && getPendingValue(vendor.contracted_value, vendor.paid_value) > 0 && new Date(`${vendor.due_date}T23:59:59`) < new Date());
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Vendors() {
  const navigate = useNavigate();
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const customCategories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [confirming, setConfirming] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const rows = useMemo(
    () =>
      vendors.rows.filter(
        (vendor) =>
          `${vendor.name} ${vendor.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()) &&
          (!category || toPrimaryCategory(vendor.category) === category) &&
          (!status || vendor.status === status)
      ),
    [category, search, status, vendors.rows]
  );

  const budgetByVendorId = useMemo(() => new Map(budgetItems.rows.filter((item) => item.vendor_id).map((item) => [item.vendor_id, item])), [budgetItems.rows]);
  const categoryOptions = useMemo(() => {
    const custom = customCategories.rows
      .map((category) => category.name.trim())
      .filter((name) => name && toPrimaryCategory(name) === name);
    return Array.from(new Set([...vendorCategories, ...custom]));
  }, [customCategories.rows]);

  const activeFilterCount = useMemo(
    () => [search.trim(), category, status].filter(Boolean).length,
    [category, search, status]
  );

  useEffect(() => {
    vendors.rows
      .filter((vendorItem) => vendorItem.category !== toPrimaryCategory(vendorItem.category))
      .forEach((vendorItem) => {
        vendors.update(vendorItem.id, { category: toPrimaryCategory(vendorItem.category) } as Partial<Vendor>).catch(console.error);
      });
    budgetItems.rows
      .filter((item) => item.category !== toPrimaryCategory(item.category))
      .forEach((item) => {
        budgetItems.update(item.id, { category: toPrimaryCategory(item.category) } as Partial<BudgetItem>).catch(console.error);
      });
  }, [budgetItems.rows, vendors.rows]);

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
            status: row.status,
            contract_url: row.contract_url ?? '',
            notes: row.notes ?? ''
          }
        : blank
    );
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      category: toPrimaryCategory(form.category),
      due_date: form.due_date || null
    };
    if (editing) await vendors.update(editing.id, payload as Partial<Vendor>);
    else await vendors.create(payload as Partial<Vendor>);
    setOpen(false);
  }

  async function confirmHiring() {
    if (!confirming) return;
    const updatedVendor = { ...confirming, status: 'contratado' };
    await vendors.update(confirming.id, { status: 'contratado' });

    const existing = budgetItems.rows.find((item) => item.vendor_id === confirming.id);
    const payload = vendorToBudgetPayload(updatedVendor);
    if (existing) await budgetItems.update(existing.id, payload as Partial<BudgetItem>);
    else await budgetItems.create(payload as Partial<BudgetItem>);

    setMessage(`Contratação de ${confirming.name} confirmada e orçamento sincronizado.`);
    setConfirming(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await vendors.remove(deleting.id);
    setDeleting(null);
  }

  function clearFilters() {
    setSearch('');
    setCategory('');
    setStatus('');
  }

  function renderActions(row: Vendor) {
    const alreadyContracted = row.status === 'contratado';
    return (
      <div className="flex flex-wrap gap-2">
        {!alreadyContracted ? (
          <button type="button" className="btn-secondary border-[#5F8D6D]/30 bg-[#5F8D6D]/10 text-[#5F8D6D]" onClick={() => setConfirming(row)} title="Confirmar Contratação">
            <CheckCircle2 size={16} /> Confirmar Contratação
          </button>
        ) : (
          <button type="button" className="btn-secondary border-[#E7E0D8] bg-white text-[#2D2A26]" onClick={() => navigate(`/orcamento/${categoryToBudgetSlug(row.category)}`)} title="Ver no orçamento">
            <ExternalLink size={16} /> Ver no orçamento
          </button>
        )}
        <button type="button" className="btn-secondary px-3" onClick={() => start(row)} title="Editar">
          <Edit2 size={15} />
        </button>
        <button type="button" className="btn-secondary px-3" onClick={() => setDeleting(row)} title="Excluir">
          <Trash2 size={15} className="text-[#C46A6A]" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#2D2A26]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-[#2D2A26]">Fornecedores</h1>
          <p className="mt-1 text-sm text-[#6F6760]">Cadastre, pesquise, negocie e confirme contratações para alimentar o orçamento.</p>
        </div>
        <button className="btn-primary bg-[#B76E79]" onClick={() => start()}>
          <Plus size={16} /> Fornecedor
        </button>
      </div>

      {message && <div className="rounded-lg border border-[#5F8D6D]/25 bg-[#5F8D6D]/12 p-3 text-sm text-[#5F8D6D]">{message}</div>}

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={clearFilters} clearLabel="Limpar" gridClassName="lg:grid-cols-[1.6fr_1fr_1fr_auto]">
          <label className="block">
            <span className="label text-[#6F6760]">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B76E79]" size={18} />
              <input className="input border-[#E7E0D8] bg-[#FAF8F5] pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou telefone" />
            </div>
          </label>
          <FormSelect label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ label: 'Todas', value: '' }, ...categoryOptions.map((value) => ({ label: value, value }))]} />
          <FormSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ label: 'Todos', value: '' }, ...vendorStatuses.map((value) => ({ label: value, value }))]} />
      </ResponsiveFilters>

      <section className="grid gap-3">
        {rows.length ? (
          rows.map((row) => {
            const paymentStatus = isVendorOverdue(row) ? 'vencido' : getPaymentStatus(row.contracted_value, row.paid_value);
            const pending = getPendingValue(row.contracted_value, row.paid_value);
            return (
              <article key={row.id} className="rounded-lg border border-[#E7E0D8] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge value={row.status} />
                      <Badge value={paymentStatus} type="payment" />
                      {budgetByVendorId.has(row.id) && <span className="rounded-full bg-[#E7E0D8] px-2.5 py-1 text-xs font-semibold text-[#6F6760]">no orçamento</span>}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-[#2D2A26]">{row.name}</h3>
                    <p className="text-sm text-[#6F6760]">
                      {toPrimaryCategory(row.category)} ·{' '}
                      {row.phone ? (
                        <a className="font-medium text-[#2D2A26] transition hover:text-[#B76E79]" href={buildWhatsAppChatLink(row.phone)} target="_blank" rel="noreferrer">
                          {row.phone}
                        </a>
                      ) : 'sem telefone'}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div><p className="text-xs text-[#6F6760]">Contratado</p><p className="font-semibold">{formatMoney(row.contracted_value)}</p></div>
                    <div><p className="text-xs text-[#6F6760]">Pago</p><p className="font-semibold text-[#5F8D6D]">{formatMoney(row.paid_value)}</p></div>
                    <div><p className="text-xs text-[#6F6760]">Pendente</p><p className="font-semibold text-[#B07C45]">{formatMoney(pending)}</p></div>
                    <div><p className="text-xs text-[#6F6760]">Vencimento</p><p className={`font-semibold ${paymentStatus === 'vencido' ? 'text-[#C46A6A]' : ''}`}>{formatDate(row.due_date)}</p></div>
                  </div>
                  <div className="xl:justify-self-end">{renderActions(row)}</div>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState icon={Handshake} title="Nenhum fornecedor encontrado" text="Cadastre fornecedores ou ajuste os filtros." />
        )}
      </section>

      <Modal open={open} title={editing ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setOpen(false)}>
        <form className="-m-4 flex min-h-full flex-col [&_.input]:text-sm [&_.label]:mb-0.5 [&_.label]:text-[10px] [&_input.input]:h-9 [&_select.input]:h-9 [&_textarea.input]:min-h-20 sm:-m-5 sm:min-h-0 sm:[&_.label]:mb-1 sm:[&_.label]:text-xs sm:[&_input.input]:h-auto sm:[&_select.input]:h-auto sm:[&_textarea.input]:min-h-24" onSubmit={submit}>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24 sm:space-y-4 sm:p-5">
            <section className="rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-2.5 sm:p-4">
              <h3 className="text-sm font-semibold text-[#2D2A26]">Dados principais</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
                <FormInput label="Nome do fornecedor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <FormSelect label="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={categoryOptions.map((value) => ({ label: value, value }))} />
                <FormInput label="Nome do contato" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                <FormInput label="Telefone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
                <CurrencyInput label="Valor contratado" value={form.contracted_value} onValueChange={(value) => setForm({ ...form, contracted_value: value })} />
                <FormSelect label="Status" value={form.status === 'contratado' ? 'em negociação' : form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={editableVendorStatuses.map((value) => ({ label: value, value }))} />
              </div>
            </section>

            <details className="group rounded-lg border border-[#E7E0D8] bg-white p-2.5 sm:p-4" open={Boolean(editing)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#2D2A26]">
                Mais detalhes
                <ChevronDown size={16} className="text-[#6F6760] transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
                <FormInput label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <FormInput label="Instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
                <FormInput label="Site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
                <CurrencyInput label="Valor pago" value={form.paid_value} onValueChange={(value) => setForm({ ...form, paid_value: value })} />
                <FormInput label="Data de vencimento" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <FileUpload folder="contratos" onUploaded={(url) => setForm({ ...form, contract_url: url })} />
                {form.contract_url && <a className="text-sm text-rosew-500" href={form.contract_url} target="_blank" rel="noreferrer">Ver contrato</a>}
              </div>
              <div className="mt-4">
                <FormTextarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </details>
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-[#E7E0D8] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 sm:flex sm:justify-end sm:px-5 sm:py-4">
            <button type="button" className="btn-secondary h-9 sm:h-auto" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary h-9 bg-[#B76E79] sm:h-auto">Salvar fornecedor</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirming)} title="Confirmar Contratação" onClose={() => setConfirming(null)}>
        {confirming && (
          <div className="space-y-5">
            <p className="text-sm text-[#6F6760]">Deseja realmente confirmar a Contratação de <strong className="text-[#2D2A26]">{confirming.name}</strong>?</p>
            <div className="grid gap-3 rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-4 sm:grid-cols-2">
              <div><p className="text-xs text-[#6F6760]">Nome</p><p className="font-semibold">{confirming.name}</p></div>
              <div><p className="text-xs text-[#6F6760]">Categoria</p><p className="font-semibold">{toPrimaryCategory(confirming.category)}</p></div>
              <div><p className="text-xs text-[#6F6760]">Valor contratado</p><p className="font-semibold">{formatMoney(confirming.contracted_value)}</p></div>
              <div><p className="text-xs text-[#6F6760]">Vencimento</p><p className="font-semibold">{formatDate(confirming.due_date)}</p></div>
              <div>
                <p className="text-xs text-[#6F6760]">Telefone</p>
                <p className="font-semibold">
                  {confirming.phone ? (
                    <a className="text-[#2D2A26] transition hover:text-[#B76E79]" href={buildWhatsAppChatLink(confirming.phone)} target="_blank" rel="noreferrer">
                      {confirming.phone}
                    </a>
                  ) : '-'}
                </p>
              </div>
              <div><p className="text-xs text-[#6F6760]">Status atual</p><p className="font-semibold capitalize">{confirming.status}</p></div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirming(null)}>Cancelar</button>
              <button className="btn-primary bg-[#B76E79]" onClick={confirmHiring}>Confirmar Contratação</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir ${deleting?.name ?? 'este fornecedor'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}


