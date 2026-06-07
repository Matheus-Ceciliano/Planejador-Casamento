import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FormSelect from '../components/FormSelect';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Vendor } from '../types';
import { getPendingValue, isBudgetOverdue } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';

const dueOptions = [
  { label: 'Todos', value: '' },
  { label: 'Vencidos', value: 'overdue' },
  { label: 'Próximos 7 dias', value: 'next7' },
  { label: 'Próximos 30 dias', value: 'next30' },
  { label: 'Sem vencimento', value: 'no_due' }
];

function dueFilterMatch(item: BudgetItem, filter: string) {
  const now = new Date();
  const inSeven = new Date(now);
  inSeven.setDate(now.getDate() + 7);
  const inThirty = new Date(now);
  inThirty.setDate(now.getDate() + 30);
  const due = item.due_date ? new Date(`${item.due_date}T12:00:00`) : null;

  return (
    !filter ||
    (filter === 'overdue' && isBudgetOverdue(item)) ||
    (filter === 'next7' && due && due >= now && due <= inSeven) ||
    (filter === 'next30' && due && due >= now && due <= inThirty) ||
    (filter === 'no_due' && !due)
  );
}

export default function BudgetDueDates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(() => (searchParams.get('filter') === 'overdue' ? 'overdue' : 'next30'));

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor.name])), [vendors.rows]);

  const rows = useMemo(
    () =>
      items.rows
        .filter((item) => getPendingValue(item.contracted_value, item.paid_value) > 0)
        .filter((item) => `${item.name} ${vendorById.get(item.vendor_id ?? '') ?? ''}`.toLowerCase().includes(search.toLowerCase()))
        .filter((item) => dueFilterMatch(item, filter))
        .sort((a, b) => String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31'))),
    [filter, items.rows, search, vendorById]
  );

  const overdueCount = items.rows.filter(isBudgetOverdue).length;
  const pendingTotal = rows.reduce((sum, item) => sum + getPendingValue(item.contracted_value, item.paid_value), 0);
  const activeFilterCount = useMemo(
    () => [search.trim(), filter !== 'next30' ? filter : ''].filter(Boolean).length,
    [filter, search]
  );

  function clearFilters() {
    setSearch('');
    setFilter('next30');
  }

  return (
    <div className="space-y-6 text-[#2D2A26]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-[#2D2A26]">Vencimentos</h1>
          <p className="mt-1 text-sm text-[#6F6760]">Acompanhe pagamentos pendentes, atrasados e próximos vencimentos.</p>
        </div>
        <button className="btn-secondary border-[#E7E0D8] bg-white text-[#2D2A26]" onClick={() => navigate('/orcamento')}>
          <ArrowLeft size={16} /> Voltar ao orçamento
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[#E7E0D8] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6F6760]">Itens exibidos</p>
          <p className="mt-2 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-[#E7E0D8] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6F6760]">Total pendente</p>
          <p className="mt-2 text-2xl font-semibold text-[#B07C45]">{formatMoney(pendingTotal)}</p>
        </div>
        <div className="rounded-lg border border-[#C46A6A]/20 bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6F6760]">Vencidos</p>
          <p className="mt-2 text-2xl font-semibold text-[#C46A6A]">{overdueCount}</p>
        </div>
      </section>

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={clearFilters} gridClassName="md:grid-cols-[1fr_260px_auto]">
          <label className="block">
            <span className="label text-[#6F6760]">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B76E79]" size={18} />
              <input
                className="input border-[#E7E0D8] bg-[#FAF8F5] pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Gasto ou fornecedor"
              />
            </div>
          </label>
          <FormSelect label="Período" value={filter} onChange={(event) => setFilter(event.target.value)} options={dueOptions} />
      </ResponsiveFilters>

      <section className="grid gap-3">
        {rows.length ? (
          rows.map((item) => {
            const overdue = isBudgetOverdue(item);
            return (
              <article key={item.id} className={`rounded-lg border bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)] ${overdue ? 'border-[#C46A6A]/30' : 'border-[#E7E0D8]'}`}>
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#B76E79]/18 px-2.5 py-1 text-xs font-semibold text-[#B76E79]">{item.category}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-[#C46A6A]/15 text-[#C46A6A]' : 'bg-[#E7E0D8] text-[#6F6760]'}`}>
                        {overdue ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
                        {overdue ? 'vencido' : 'pendente'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-[#6F6760]">Fornecedor: {vendorById.get(item.vendor_id ?? '') ?? '-'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                    <div><p className="text-xs text-[#6F6760]">Vencimento</p><p className={`font-semibold ${overdue ? 'text-[#C46A6A]' : ''}`}>{formatDate(item.due_date)}</p></div>
                    <div><p className="text-xs text-[#6F6760]">Pendente</p><p className="font-semibold text-[#B07C45]">{formatMoney(getPendingValue(item.contracted_value, item.paid_value))}</p></div>
                    <div><p className="text-xs text-[#6F6760]">Pago</p><p className="font-semibold text-[#5F8D6D]">{formatMoney(item.paid_value)}</p></div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState icon={CheckCircle2} title="Nenhum vencimento encontrado" text="Não há pagamentos pendentes para o filtro selecionado." />
        )}
      </section>
    </div>
  );
}
