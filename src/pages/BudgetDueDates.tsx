import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('next30');

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
    <div className="min-h-screen space-y-6 bg-[#FFF8F6] text-[#2F2926]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-[#2F2926]">Vencimentos</h1>
          <p className="mt-1 text-sm text-[#7A6F6B]">Acompanhe pagamentos pendentes, atrasados e próximos vencimentos.</p>
        </div>
        <button className="btn-secondary border-[#F3E3D3] bg-white text-[#3A2B27]" onClick={() => navigate('/orcamento')}>
          <ArrowLeft size={16} /> Voltar ao orçamento
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[#F3E3D3] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A6F6B]">Itens exibidos</p>
          <p className="mt-2 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-[#F3E3D3] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A6F6B]">Total pendente</p>
          <p className="mt-2 text-2xl font-semibold text-[#9a7436]">{formatMoney(pendingTotal)}</p>
        </div>
        <div className="rounded-lg border border-[#C97C7C]/20 bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A6F6B]">Vencidos</p>
          <p className="mt-2 text-2xl font-semibold text-[#a95757]">{overdueCount}</p>
        </div>
      </section>

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={clearFilters} gridClassName="md:grid-cols-[1fr_260px_auto]">
          <label className="block">
            <span className="label text-[#7A6F6B]">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D8A7A0]" size={18} />
              <input
                className="input border-[#F3E3D3] bg-[#FFF8F6] pl-10"
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
              <article key={item.id} className={`rounded-lg border bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)] ${overdue ? 'border-[#C97C7C]/30' : 'border-[#F3E3D3]'}`}>
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#D8A7A0]/18 px-2.5 py-1 text-xs font-semibold text-[#9f675f]">{item.category}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-[#C97C7C]/15 text-[#a95757]' : 'bg-[#F3E3D3] text-[#7A6F6B]'}`}>
                        {overdue ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
                        {overdue ? 'vencido' : 'pendente'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-[#7A6F6B]">Fornecedor: {vendorById.get(item.vendor_id ?? '') ?? '-'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                    <div><p className="text-xs text-[#7A6F6B]">Vencimento</p><p className={`font-semibold ${overdue ? 'text-[#a95757]' : ''}`}>{formatDate(item.due_date)}</p></div>
                    <div><p className="text-xs text-[#7A6F6B]">Pendente</p><p className="font-semibold text-[#9a7436]">{formatMoney(getPendingValue(item.contracted_value, item.paid_value))}</p></div>
                    <div><p className="text-xs text-[#7A6F6B]">Pago</p><p className="font-semibold text-[#5f7f4d]">{formatMoney(item.paid_value)}</p></div>
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
