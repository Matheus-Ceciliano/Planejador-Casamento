import { CalendarClock, CheckCircle2, FileText, MoreHorizontal, Paperclip, Receipt, Search, WalletCards, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import FormSelect from '../components/FormSelect';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, PaymentRecord, Vendor } from '../types';
import { getPaymentStatus } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';

type PeriodFilter = '' | 'today' | 'month' | 'custom';

function statusLabel(status: string) {
  return status === 'canceled' ? 'Cancelado' : 'Confirmado';
}

function statusTone(status: string) {
  return status === 'canceled' ? 'badge-red' : 'badge-green';
}

function isoDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function periodLabel(value: PeriodFilter) {
  if (value === 'today') return 'Hoje';
  if (value === 'month') return 'Este mês';
  if (value === 'custom') return 'Personalizado';
  return '';
}

function Kpi({
  label,
  value,
  helper,
  tone = 'text-w-text',
  icon: Icon,
  accent = 'border-w-border bg-white'
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
  icon: typeof Receipt;
  accent?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-w-faint">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-w-muted ring-1 ring-w-border">
          <Icon size={16} />
        </span>
      </div>
      <p className={`mt-1.5 truncate text-[22px] font-bold leading-7 ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-w-muted">{helper}</p>
    </div>
  );
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const paymentRecords = useWeddingTable<PaymentRecord>('payment_history', 'created_at');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'name');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [canceling, setCanceling] = useState<PaymentRecord | null>(null);
  const [openActionId, setOpenActionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor])), [vendors.rows]);
  const itemById = useMemo(() => new Map(budgetItems.rows.map((item) => [item.id, item])), [budgetItems.rows]);
  const methods = useMemo(
    () => Array.from(new Set(paymentRecords.rows.map((record) => record.payment_method).filter(Boolean) as string[])),
    [paymentRecords.rows]
  );

  const hasFilters = Boolean(search.trim() || status || method || period || startDate || endDate);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = isoDate();
    const from = period === 'today' ? today : period === 'month' ? monthStart() : period === 'custom' ? startDate : '';
    const to = period === 'today' ? today : period === 'custom' ? endDate : '';

    return [...paymentRecords.rows]
      .reverse()
      .filter((record) => {
        const vendor = record.vendor_id ? vendorById.get(record.vendor_id) : undefined;
        const item = record.budget_item_id ? itemById.get(record.budget_item_id) : undefined;
        const valueText = `${record.amount} ${formatMoney(record.amount)}`.toLowerCase();
        const haystack = `${record.ap_number} ${vendor?.name ?? ''} ${item?.name ?? ''} ${valueText}`.toLowerCase();
        const paymentDate = record.payment_date ?? '';

        return (
          (!query || haystack.includes(query)) &&
          (!status || record.status === status) &&
          (!method || record.payment_method === method) &&
          (!from || paymentDate >= from) &&
          (!to || paymentDate <= to)
        );
      });
  }, [endDate, itemById, method, paymentRecords.rows, period, search, startDate, status, vendorById]);

  const summary = useMemo(() => {
    const confirmed = paymentRecords.rows.filter((record) => record.status === 'confirmed');
    const canceled = paymentRecords.rows.filter((record) => record.status === 'canceled');
    const receipts = paymentRecords.rows.filter((record) => record.receipt_file_url);
    const periodTotal = rows.filter((record) => record.status === 'confirmed').reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
    return {
      totalPaid: confirmed.reduce((sum, record) => sum + Number(record.amount ?? 0), 0),
      confirmed: confirmed.length,
      canceled: canceled.length,
      receipts: receipts.length,
      periodTotal
    };
  }, [paymentRecords.rows, rows]);

  function clearFilters() {
    setSearch('');
    setStatus('');
    setMethod('');
    setPeriod('');
    setStartDate('');
    setEndDate('');
  }

  async function cancelPayment() {
    if (!canceling || submitting || canceling.status !== 'confirmed') return;
    const item = canceling.budget_item_id ? itemById.get(canceling.budget_item_id) : undefined;
    if (!item) {
      setMessage('Não foi possível localizar o item financeiro desta AP.');
      setCanceling(null);
      return;
    }

    setSubmitting(true);
    try {
      const amount = Number(canceling.amount ?? 0);
      const nextPaid = Math.max(0, Number(item.paid_value ?? 0) - amount);
      await budgetItems.update(item.id, {
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

      await paymentRecords.update(canceling.id, {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        canceled_by: user?.id ?? null
      } as Partial<PaymentRecord>);
      setMessage('Pagamento cancelado. O saldo foi recalculado.');
      setCanceling(null);
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 pb-28 text-w-text lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Histórico de Pagamentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-w-muted sm:text-base">Consulte pagamentos confirmados, comprovantes e APs geradas.</p>
        </div>
        <button type="button" className="btn-secondary min-h-11 w-full justify-center sm:w-auto" onClick={() => navigate('/orcamento')}>
          <WalletCards size={16} /> Ver orçamento
        </button>
      </div>

      {message && <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]">{message}</div>}

      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <Kpi label="Total pago" value={formatMoney(summary.totalPaid)} helper="APs confirmadas" tone={summary.totalPaid > 0 ? 'text-[#16A34A]' : 'text-w-text'} icon={WalletCards} accent={summary.totalPaid > 0 ? 'border-green-100 bg-green-50/35' : 'border-w-border bg-white'} />
        <Kpi label="Confirmados" value={String(summary.confirmed)} helper="Pagamentos ativos" tone={summary.confirmed > 0 ? 'text-[#16A34A]' : 'text-w-text'} icon={CheckCircle2} accent="border-w-border bg-white" />
        <Kpi label="Cancelados" value={String(summary.canceled)} helper="Mantidos para auditoria" tone={summary.canceled > 0 ? 'text-[#DC2626]' : 'text-w-text'} icon={XCircle} accent={summary.canceled > 0 ? 'border-red-100 bg-red-50/30' : 'border-w-border bg-white'} />
        <Kpi label="Comprovantes" value={String(summary.receipts)} helper="Anexos vinculados" tone={summary.receipts > 0 ? 'text-w-rose' : 'text-w-text'} icon={Paperclip} accent={summary.receipts > 0 ? 'border-rose-100 bg-rose-50/30' : 'border-w-border bg-white'} />
        <Kpi label="Período" value={formatMoney(summary.periodTotal)} helper="Total filtrado" tone="text-w-text" icon={CalendarClock} accent="border-w-border bg-white" />
      </section>

      <section className="rounded-2xl border border-w-border bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-4">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(280px,1.5fr)_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
          <label className="block">
            <span className="field-label">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-w-faint" size={16} />
              <input className="input h-11 pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="AP, fornecedor, item ou valor" />
            </div>
          </label>
          <FormSelect label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: 'Todos', value: '' }, { label: 'Confirmado', value: 'confirmed' }, { label: 'Cancelado', value: 'canceled' }]} />
          <FormSelect label="Forma" value={method} onChange={(event) => setMethod(event.target.value)} options={[{ label: 'Todas', value: '' }, ...methods.map((item) => ({ label: item, value: item }))]} />
          <FormSelect label="Período" value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} options={[{ label: 'Todos', value: '' }, { label: 'Hoje', value: 'today' }, { label: 'Este mês', value: 'month' }, { label: 'Personalizado', value: 'custom' }]} />
          <button type="button" className="btn-secondary h-11 px-4 text-sm" onClick={clearFilters}>Limpar filtros</button>
        </div>
        {period === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="field-label">De</span><input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label className="block"><span className="field-label">Até</span><input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
        )}
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {search.trim() && <span className="rounded-full bg-w-surface px-2.5 py-1 text-xs font-semibold text-w-muted">Busca: {search.trim()}</span>}
            {status && <span className="rounded-full bg-w-surface px-2.5 py-1 text-xs font-semibold text-w-muted">Status: {statusLabel(status)}</span>}
            {method && <span className="rounded-full bg-w-surface px-2.5 py-1 text-xs font-semibold text-w-muted">Forma: {method}</span>}
            {period && <span className="rounded-full bg-w-surface px-2.5 py-1 text-xs font-semibold text-w-muted">Período: {periodLabel(period)}</span>}
            <button type="button" className="rounded-full px-2.5 py-1 text-xs font-bold text-w-rose hover:bg-rose-50" onClick={clearFilters}>Limpar todos</button>
          </div>
        )}
      </section>

      {!paymentRecords.rows.length ? (
        <section className="rounded-3xl border border-dashed border-w-border bg-white/80 p-7 text-center shadow-[0_16px_36px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-w-surface text-w-faint ring-1 ring-w-border">
            <Receipt size={30} />
          </div>
          <h2 className="mt-4 text-lg font-bold">Nenhum pagamento registrado</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-w-muted">Quando um pagamento for confirmado, ele aparecerá aqui com número de AP, comprovante e histórico.</p>
          <button type="button" className="btn-primary mt-4" onClick={() => navigate('/orcamento')}>Ver orçamento</button>
        </section>
      ) : !rows.length ? (
        <section className="rounded-3xl border border-dashed border-w-border-md bg-white p-8 text-center shadow-soft">
          <XCircle className="mx-auto text-w-faint" size={34} />
          <h2 className="mt-3 text-lg font-bold">Nenhum pagamento encontrado com esses filtros</h2>
          <button type="button" className="btn-primary mt-4" onClick={clearFilters}>Limpar filtros</button>
        </section>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-3xl border border-w-border bg-white shadow-soft lg:block">
            <div className="grid grid-cols-[100px_1.1fr_1.1fr_120px_110px_110px_110px_130px_110px] gap-3 bg-w-surface px-4 py-3 text-xs font-bold uppercase tracking-wide text-w-faint">
              <span>AP</span><span>Fornecedor</span><span>Item</span><span>Valor</span><span>Forma</span><span>Data</span><span>Status</span><span>Comprovante</span><span>Ações</span>
            </div>
            <div className="divide-y divide-w-border">
              {rows.map((record) => {
                const vendor = record.vendor_id ? vendorById.get(record.vendor_id) : undefined;
                const item = record.budget_item_id ? itemById.get(record.budget_item_id) : undefined;
                return (
                  <div key={record.id} className="grid grid-cols-[100px_1.1fr_1.1fr_120px_110px_110px_110px_130px_110px] items-center gap-3 px-4 py-3 text-sm">
                    <button type="button" className="text-left font-bold text-w-rose hover:underline" onClick={() => setSelected(record)}>{record.ap_number}</button>
                    <span className="truncate font-semibold">{vendor?.name ?? '-'}</span>
                    <span className="truncate text-w-muted">{item?.name ?? '-'}</span>
                    <span className="font-semibold">{formatMoney(record.amount)}</span>
                    <span className="text-w-muted">{record.payment_method || '-'}</span>
                    <span className="text-w-muted">{formatDate(record.payment_date)}</span>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-w-muted transition hover:bg-w-surface hover:text-w-text"
                        onClick={() => setOpenActionId(openActionId === record.id ? '' : record.id)}
                        aria-label="Ações do pagamento"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {openActionId === record.id && (
                        <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-2xl border border-w-border bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                          <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-w-text hover:bg-w-surface" onClick={() => { setSelected(record); setOpenActionId(''); }}>Detalhes</button>
                          {record.receipt_file_url ? (
                            <a className="block rounded-xl px-3 py-2 text-sm font-semibold text-w-text hover:bg-w-surface" href={record.receipt_file_url} target="_blank" rel="noreferrer" onClick={() => setOpenActionId('')}>Ver comprovante</a>
                          ) : (
                            <span className="block rounded-xl px-3 py-2 text-sm font-semibold text-w-muted">Sem comprovante</span>
                          )}
                          {record.status === 'confirmed' && (
                            <button type="button" className="mt-1 w-full rounded-xl border-t border-w-border px-3 py-2 text-left text-sm font-semibold text-[#DC2626] hover:bg-red-50" onClick={() => { setCanceling(record); setOpenActionId(''); }}>Cancelar pagamento</button>
                          )}
                        </div>
                      )}
                    </div>
                    {record.receipt_file_url ? (
                      <a className="inline-flex w-fit rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100" href={record.receipt_file_url} target="_blank" rel="noreferrer">Disponível</a>
                    ) : (
                      <span className="inline-flex w-fit rounded-full bg-w-surface px-2.5 py-1 text-xs font-bold text-w-muted">Sem comprovante</span>
                    )}
                    <span className="flex gap-2">
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setSelected(record)}>Detalhes</button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-2 lg:hidden">
            {rows.map((record) => {
              const vendor = record.vendor_id ? vendorById.get(record.vendor_id) : undefined;
              const item = record.budget_item_id ? itemById.get(record.budget_item_id) : undefined;
              return (
                <article key={record.id} className="rounded-2xl border border-w-border bg-white p-3 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-w-rose">{record.ap_number}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{vendor?.name ?? 'Sem fornecedor'}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-w-muted">{item?.name ?? 'Sem item vinculado'}</p>
                    </div>
                    <span className={statusTone(record.status)}>{statusLabel(record.status)}</span>
                  </div>
                  <p className="mt-2 text-lg font-bold">{formatMoney(record.amount)}</p>
                  <p className="text-xs font-semibold text-w-muted">{record.payment_method || '-'} · {formatDate(record.payment_date)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={statusTone(record.status)}>{statusLabel(record.status)}</span>
                    {record.receipt_file_url ? (
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">Com comprovante</span>
                    ) : (
                      <span className="rounded-full bg-w-surface px-2.5 py-1 text-xs font-bold text-w-muted">Sem comprovante</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <button type="button" className="btn-primary min-h-10 justify-center text-sm" onClick={() => setSelected(record)}>
                      Detalhes
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}

      <Modal open={Boolean(selected)} title="Detalhes da AP" onClose={() => setSelected(null)}>
        {selected && (
          (() => {
            const vendor = selected.vendor_id ? vendorById.get(selected.vendor_id) : undefined;
            const item = selected.budget_item_id ? itemById.get(selected.budget_item_id) : undefined;
            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-w-border bg-w-surface p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-w-faint">Número da AP</p>
                    <h3 className="mt-1 text-2xl font-bold">{selected.ap_number}</h3>
                  </div>
                  <span className={statusTone(selected.status)}>{statusLabel(selected.status)}</span>
                </div>
                <dl className="grid gap-3 rounded-2xl border border-w-border bg-white p-4 text-sm shadow-soft sm:grid-cols-2">
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Fornecedor</dt><dd className="mt-1 font-semibold">{vendor?.name ?? '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Item financeiro</dt><dd className="mt-1 font-semibold">{item?.name ?? '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Valor pago</dt><dd className="mt-1 font-semibold">{formatMoney(selected.amount)}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Forma de pagamento</dt><dd className="mt-1 font-semibold">{selected.payment_method || '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Data do pagamento</dt><dd className="mt-1 font-semibold">{formatDate(selected.payment_date)}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Data da confirmação</dt><dd className="mt-1 font-semibold">{selected.confirmed_at ? formatDate(selected.confirmed_at.slice(0, 10)) : '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Confirmado por</dt><dd className="mt-1 font-semibold">{selected.confirmed_by || '-'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-w-faint">Comprovante</dt><dd className="mt-1 font-semibold">{selected.receipt_file_url ? 'Disponível' : 'Sem comprovante'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-w-faint">Observação</dt><dd className="mt-1 font-semibold">{selected.notes || '-'}</dd></div>
                </dl>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {selected.status === 'confirmed' && <button type="button" className="btn-secondary text-[#DC2626]" onClick={() => setCanceling(selected)}>Cancelar pagamento</button>}
                  {selected.receipt_file_url ? <a className="btn-secondary text-center" href={selected.receipt_file_url} target="_blank" rel="noreferrer"><FileText size={15} /> Ver comprovante</a> : <span className="inline-flex items-center justify-center rounded-xl bg-w-surface px-4 py-2 text-sm font-semibold text-w-muted">Sem comprovante</span>}
                  <button type="button" className="btn-primary" onClick={() => setSelected(null)}>Fechar</button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(canceling)}
        title="Cancelar pagamento?"
        description="Tem certeza que deseja cancelar este pagamento? O valor ser? removido do total pago e o saldo restante ser? recalculado. A AP continuar? registrada no hist?rico."
        confirmLabel="Sim, cancelar pagamento"
        variant="danger"
        loading={submitting}
        details={canceling ? [
          { label: 'AP', value: canceling.ap_number },
          { label: 'Valor', value: formatMoney(canceling.amount) },
          { label: 'Forma', value: canceling.payment_method || '-' }
        ] : undefined}
        onCancel={() => setCanceling(null)}
        onConfirm={cancelPayment}
      />
    </div>
  );
}
