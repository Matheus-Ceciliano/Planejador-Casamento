import {
  CheckCircle2,
  Download,
  Edit2,
  HelpCircle,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Trash2,
  Users,
  UserPlus,
  XCircle
} from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { Guest, GuestGroup, WeddingTable } from '../types';
import { toCsv } from '../utils/format';

const blank = {
  full_name: '',
  phone: '',
  group_id: '',
  guest_type: 'adulto',
  invite_status: 'não enviado',
  companions: 0,
  table_id: '',
  food_restriction: '',
  notes: '',
  gift_received: false
};

const statusOptions = ['não enviado', 'enviado', 'confirmado', 'recusado', 'dúvida'];
const typeOptions = ['adulto', 'criança', 'especial', 'padrinho', 'madrinha', 'família da noiva', 'família do noivo', 'amigo', 'fornecedor'];

const withoutTableFilter = '__sem_mesa';
type SummaryFilter = 'total' | 'confirmed' | 'pending' | 'refused';

const statusStyle: Record<string, string> = {
  confirmado: 'bg-[#8FA87A]/15 text-[#5f7f4d] ring-[#8FA87A]/25',
  recusado: 'bg-[#C97C7C]/15 text-[#a95757] ring-[#C97C7C]/25',
  dúvida: 'bg-amber-100 text-amber-700 ring-amber-200',
  pendente: 'bg-[#F3E3D3] text-[#7A6F6B] ring-[#ead5c1]',
  'não enviado': 'bg-[#F3E3D3] text-[#7A6F6B] ring-[#ead5c1]',
  enviado: 'bg-[#D8A7A0]/15 text-[#b0736b] ring-[#D8A7A0]/25'
};

const typeStyle: Record<string, string> = {
  adulto: 'bg-[#3A2B27]/8 text-[#3A2B27] ring-[#3A2B27]/10',
  criança: 'bg-[#D8A7A0]/18 text-[#9f675f] ring-[#D8A7A0]/30',
  especial: 'bg-[#8FA87A]/15 text-[#60784f] ring-[#8FA87A]/25',
  padrinho: 'bg-[#F3E3D3] text-[#806c58] ring-[#ead5c1]',
  madrinha: 'bg-[#D8A7A0]/20 text-[#9f675f] ring-[#D8A7A0]/30'
};

function Badge({ value, kind = 'status' }: { value: string; kind?: 'status' | 'type' }) {
  const classes = kind === 'status' ? statusStyle[value] : typeStyle[value];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${classes ?? 'bg-stone-100 text-stone-600 ring-stone-200'}`}>
      {value}
    </span>
  );
}

function isPendingStatus(status: string) {
  return !['confirmado', 'recusado'].includes(status);
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'neutral',
  active,
  onClick
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    neutral: {
      value: 'text-[#2F2926]',
      icon: 'bg-[#F3E3D3] text-[#7A6F6B]'
    },
    success: {
      value: 'text-[#5f7f4d]',
      icon: 'bg-[#8FA87A]/15 text-[#5f7f4d]'
    },
    warning: {
      value: 'text-[#8a5a12]',
      icon: 'bg-[#D5A65A]/15 text-[#8a5a12]'
    },
    danger: {
      value: 'text-[#a95757]',
      icon: 'bg-[#C97C7C]/15 text-[#a95757]'
    }
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[112px] rounded-lg border p-4 text-left shadow-[0_14px_32px_rgba(58,43,39,0.06)] transition hover:-translate-y-0.5 hover:border-[#D8A7A0] ${
        active ? 'border-[#3A2B27] bg-[#3A2B27] text-white' : 'border-[#F3E3D3] bg-white text-[#2F2926]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${active ? 'text-white/70' : 'text-[#7A6F6B]'}`}>{label}</p>
          <p className={`mt-2 text-3xl font-semibold ${active ? 'text-white' : tones.value}`}>{value}</p>
          <p className={`mt-1 text-sm ${active ? 'text-white/75' : 'text-[#7A6F6B]'}`}>{subtitle}</p>
        </div>
        <span className={`rounded-lg p-2 ${active ? 'bg-white/12 text-white' : tones.icon}`}>{icon}</span>
      </div>
    </button>
  );
}

function ActionButton({ title, children, onClick }: { title: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#F3E3D3] bg-white text-[#3A2B27] transition hover:border-[#D8A7A0] hover:bg-[#FFF8F6]"
    >
      {children}
    </button>
  );
}

function GuestEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-[#F3E3D3] bg-white px-4 py-5 text-center shadow-[0_10px_24px_rgba(58,43,39,0.04)] sm:px-6 sm:py-12 sm:shadow-[0_12px_28px_rgba(58,43,39,0.05)]">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3E3D3] text-[#7A6F6B] sm:h-12 sm:w-12">
        <UserPlus size={18} className="sm:h-5 sm:w-5" />
      </span>
      <h3 className="mt-2 text-base font-semibold text-[#2F2926] sm:mt-3 sm:text-lg">Nenhum convidado ainda</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-snug text-[#7A6F6B] sm:text-base">Comece adicionando convidados para acompanhar confirmações e mesas.</p>
      <button type="button" className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#3A2B27] px-3 text-sm font-medium text-white transition hover:bg-black sm:mt-4 sm:h-auto sm:px-4 sm:py-2" onClick={onAdd}>
        <Plus size={16} /> Adicionar primeiro convidado
      </button>
    </div>
  );
}

export default function Guests() {
  const guests = useWeddingTable<Guest>('guests', 'full_name');
  const groups = useWeddingTable<GuestGroup>('guest_groups', 'name');
  const tables = useWeddingTable<WeddingTable>('tables', 'name');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('confirmed');
  const [type, setType] = useState('');
  const [group, setGroup] = useState('');
  const [table, setTable] = useState('');
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const groupById = useMemo(() => new Map(groups.rows.map((item) => [item.id, item.name])), [groups.rows]);
  const tableById = useMemo(() => new Map(tables.rows.map((item) => [item.id, item.name])), [tables.rows]);

  const filtered = useMemo(
    () =>
      guests.rows.filter((guest) => {
        const matchSearch = `${guest.full_name} ${guest.phone ?? ''}`.toLowerCase().includes(search.toLowerCase());
        const matchSummary =
          summaryFilter === 'total' ||
          (summaryFilter === 'confirmed' && guest.invite_status === 'confirmado') ||
          (summaryFilter === 'pending' && isPendingStatus(guest.invite_status)) ||
          (summaryFilter === 'refused' && guest.invite_status === 'recusado');
        const matchTable = !table || (table === withoutTableFilter ? !guest.table_id : guest.table_id === table);
        return (
          matchSearch &&
          matchSummary &&
          (!type || guest.guest_type === type) &&
          (!group || guest.group_id === group) &&
          matchTable
        );
      }),
    [group, guests.rows, search, summaryFilter, table, type]
  );

  const summary = useMemo(() => {
    const countPeople = (rows: Guest[]) => rows.reduce((sum, guest) => sum + 1 + Number(guest.companions ?? 0), 0);
    return {
      total: countPeople(guests.rows),
      confirmed: countPeople(guests.rows.filter((guest) => guest.invite_status === 'confirmado')),
      pending: countPeople(guests.rows.filter((guest) => isPendingStatus(guest.invite_status))),
      refused: countPeople(guests.rows.filter((guest) => guest.invite_status === 'recusado')),
      adults: guests.rows.filter((guest) => guest.guest_type === 'adulto').length,
      children: guests.rows.filter((guest) => guest.guest_type === 'criança').length
    };
  }, [guests.rows]);

  const resultText = useMemo(() => {
    if (summaryFilter === 'confirmed') return `Mostrando ${filtered.length} convidados confirmados`;
    if (summaryFilter === 'pending') return `Mostrando ${filtered.length} convidados pendentes`;
    if (summaryFilter === 'refused') return `Mostrando ${filtered.length} convidados recusados`;
    return `Mostrando ${filtered.length} convidados`;
  }, [filtered.length, summaryFilter]);

  const confirmationPercent = summary.total ? Math.round((summary.confirmed / summary.total) * 100) : 0;

  const activeFilterCount = useMemo(
    () => [search.trim(), type, group, table].filter(Boolean).length,
    [group, search, table, type]
  );

  function start(row?: Guest) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            full_name: row.full_name,
            phone: row.phone ?? '',
            group_id: row.group_id ?? '',
            guest_type: row.guest_type,
            invite_status: row.invite_status,
            companions: row.companions ?? 0,
            table_id: row.table_id ?? '',
            food_restriction: row.food_restriction ?? '',
            notes: row.notes ?? '',
            gift_received: row.gift_received
          }
        : blank
    );
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, group_id: form.group_id || null, table_id: form.table_id || null, companions: Number(form.companions) };
    if (editing) await guests.update(editing.id, payload as Partial<Guest>);
    else await guests.create(payload as Partial<Guest>);
    setOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await guests.remove(deleting.id);
    setDeleting(null);
  }

  function clearFilters() {
    setSearch('');
    setSummaryFilter('total');
    setType('');
    setGroup('');
    setTable('');
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered as unknown as Record<string, unknown>[])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'convidados.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function whatsappLink(phone?: string | null) {
    const digits = phone?.replace(/\D/g, '');
    if (!digits) return '';
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${number}`;
  }

  function renderActions(row: Guest) {
    return (
      <div className="flex items-center gap-2">
        <ActionButton title="Confirmar presença" onClick={() => guests.update(row.id, { invite_status: 'confirmado' })}>
          <CheckCircle2 size={16} className="text-[#8FA87A]" />
        </ActionButton>
        <ActionButton title="Marcar como recusado" onClick={() => guests.update(row.id, { invite_status: 'recusado' })}>
          <XCircle size={16} className="text-[#C97C7C]" />
        </ActionButton>
        <ActionButton title="Editar convidado" onClick={() => start(row)}>
          <Edit2 size={15} />
        </ActionButton>
        <ActionButton title="Excluir convidado" onClick={() => setDeleting(row)}>
          <Trash2 size={15} className="text-[#C97C7C]" />
        </ActionButton>
      </div>
    );
  }

  const summaryChips = [
    { label: 'Todos', value: 'total' as SummaryFilter, count: summary.total },
    { label: 'Confirmados', value: 'confirmed' as SummaryFilter, count: summary.confirmed },
    { label: 'Pendentes', value: 'pending' as SummaryFilter, count: summary.pending },
    { label: 'Recusados', value: 'refused' as SummaryFilter, count: summary.refused }
  ];

  return (
    <div className="min-h-screen space-y-3 bg-[#FFF8F6] text-[#2F2926] sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="page-title text-[#2F2926]">Convidados</h1>
          <p className="mt-1 text-sm text-[#7A6F6B]">Lista com RSVP, acompanhantes, restrições e mesas.</p>
        </div>

        <div className="hidden sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">
          <button className="btn-secondary min-w-0 border-[#F3E3D3] bg-white px-3 text-[#3A2B27] sm:px-4" onClick={exportCsv}>
            <Download size={16} /> CSV
          </button>
          <button className="btn-secondary min-w-0 border-[#F3E3D3] bg-white px-3 text-[#3A2B27] sm:px-4" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
          <button className="btn-primary col-span-2 min-w-0 bg-[#3A2B27] px-3 sm:col-span-1 sm:px-4" onClick={() => start()}>
            <Plus size={16} /> Convidado
          </button>
        </div>

        <div className="relative grid grid-cols-[1fr_auto] gap-2 sm:hidden">
          <button className="btn-primary min-w-0 bg-[#3A2B27] px-3" onClick={() => start()}>
            <Plus size={16} /> Novo convidado
          </button>
          <button
            type="button"
            className="btn-secondary aspect-square border-[#F3E3D3] bg-white px-3 text-[#3A2B27]"
            aria-label="Mais ações"
            aria-expanded={mobileActionsOpen}
            onClick={() => setMobileActionsOpen((open) => !open)}
          >
            <MoreHorizontal size={18} />
          </button>
          {mobileActionsOpen && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-10 w-44 rounded-lg border border-[#F3E3D3] bg-white p-1.5 shadow-[0_16px_34px_rgba(58,43,39,0.12)]">
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#3A2B27] hover:bg-[#FFF8F6]" onClick={() => { exportCsv(); setMobileActionsOpen(false); }}>
                <Download size={15} /> Exportar CSV
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#3A2B27] hover:bg-[#FFF8F6]" onClick={() => { window.print(); setMobileActionsOpen(false); }}>
                <Printer size={15} /> Imprimir lista
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="-mx-1 flex scroll-smooth gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
        {summaryChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              summaryFilter === chip.value
                ? 'border-[#3A2B27] bg-[#3A2B27] text-white'
                : 'border-[#F3E3D3] bg-white text-[#3A2B27]'
            }`}
            onClick={() => setSummaryFilter(chip.value)}
          >
            {chip.label} <span className={summaryFilter === chip.value ? 'text-white/75' : 'text-[#7A6F6B]'}>{chip.count}</span>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-[#F3E3D3] bg-white p-3 shadow-[0_8px_18px_rgba(58,43,39,0.04)] sm:p-4 sm:shadow-[0_10px_24px_rgba(58,43,39,0.04)]">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-[#7A6F6B]">Confirmações recebidas</span>
          <strong className="text-[#2F2926]">{summary.confirmed} de {summary.total} ({confirmationPercent}%)</strong>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#F3E3D3] sm:h-2">
          <div className="h-full rounded-full bg-[#8FA87A] transition-all" style={{ width: `${confirmationPercent}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-[#7A6F6B] sm:hidden">
          {summary.confirmed ? 'Acompanhando respostas recebidas' : 'Nenhuma resposta recebida ainda'}
        </p>
      </section>

      <section className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Todos"
          value={summary.total}
          subtitle={`Lista geral • ${summary.adults} adultos • ${summary.children} crianças`}
          icon={<Users size={18} />}
          tone="neutral"
          active={summaryFilter === 'total'}
          onClick={() => setSummaryFilter('total')}
        />
        <SummaryCard
          label="Confirmados"
          value={summary.confirmed}
          subtitle={`${confirmationPercent}% do total`}
          icon={<CheckCircle2 size={18} />}
          tone="success"
          active={summaryFilter === 'confirmed'}
          onClick={() => setSummaryFilter('confirmed')}
        />
        <SummaryCard
          label="Pendentes"
          value={summary.pending}
          subtitle="Aguardando resposta"
          icon={<HelpCircle size={18} />}
          tone="warning"
          active={summaryFilter === 'pending'}
          onClick={() => setSummaryFilter('pending')}
        />
        <SummaryCard
          label="Recusados"
          value={summary.refused}
          subtitle="Não comparecerão"
          icon={<XCircle size={18} />}
          tone="danger"
          active={summaryFilter === 'refused'}
          onClick={() => setSummaryFilter('refused')}
        />
      </section>

      <ResponsiveFilters
        activeFiltersCount={activeFilterCount}
        onClearFilters={clearFilters}
        className="p-2.5 sm:p-4"
        gridClassName="md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_auto]"
        footer={<p className="mt-1.5 text-sm text-[#7A6F6B] sm:mt-4">{resultText}</p>}
      >
          <label className="block">
            <span className="label text-[#7A6F6B]">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D8A7A0]" size={18} />
              <input
                className="input border-[#F3E3D3] bg-[#FFF8F6] pl-10 text-[#2F2926] placeholder:text-[#7A6F6B]/60 focus:border-[#D8A7A0] focus:ring-[#D8A7A0]/20"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou telefone"
              />
            </div>
          </label>
          <FormSelect label="Tipo" value={type} onChange={(e) => setType(e.target.value)} options={[{ label: 'Todos', value: '' }, ...typeOptions.map((v) => ({ label: v, value: v }))]} />
          <FormSelect label="Família" value={group} onChange={(e) => setGroup(e.target.value)} options={[{ label: 'Todas', value: '' }, ...groups.rows.map((g) => ({ label: g.name, value: g.id }))]} />
          <FormSelect label="Mesa" value={table} onChange={(e) => setTable(e.target.value)} options={[{ label: 'Todas', value: '' }, { label: 'Sem mesa', value: withoutTableFilter }, ...tables.rows.map((t) => ({ label: t.name, value: t.id }))]} />
      </ResponsiveFilters>

      {filtered.length ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-[#F3E3D3] bg-white shadow-[0_16px_38px_rgba(58,43,39,0.06)] xl:block">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] text-sm">
                <thead className="bg-[#F3E3D3]/45 text-xs uppercase tracking-wide text-[#7A6F6B]">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold">Convidado</th>
                    <th className="px-5 py-4 text-left font-semibold">Contato</th>
                    <th className="px-5 py-4 text-left font-semibold">Família</th>
                    <th className="px-5 py-4 text-left font-semibold">Tipo</th>
                    <th className="px-5 py-4 text-left font-semibold">Status</th>
                    <th className="px-5 py-4 text-left font-semibold">Acomp.</th>
                    <th className="px-5 py-4 text-left font-semibold">Mesa</th>
                    <th className="px-5 py-4 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3E3D3]">
                  {filtered.map((row) => (
                    <tr key={row.id} className="transition hover:bg-[#FFF8F6]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D8A7A0]/25 text-sm font-semibold text-[#3A2B27]">
                            {row.full_name.charAt(0).toUpperCase()}
                          </span>
                          <button type="button" className="text-left font-semibold text-[#2F2926] hover:text-[#9f675f]" onClick={() => start(row)}>
                            {row.full_name}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#7A6F6B]">
                        {row.phone ? (
                          <a className="inline-flex items-center gap-2 hover:text-[#8FA87A]" href={whatsappLink(row.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp">
                            <MessageCircle size={16} />
                            {row.phone}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#7A6F6B]">{groupById.get(row.group_id ?? '') ?? '-'}</td>
                      <td className="px-5 py-4"><Badge value={row.guest_type} kind="type" /></td>
                      <td className="px-5 py-4"><Badge value={row.invite_status} /></td>
                      <td className="px-5 py-4 text-[#7A6F6B]">{row.companions}</td>
                      <td className="px-5 py-4 text-[#7A6F6B]">{tableById.get(row.table_id ?? '') ?? '-'}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">{renderActions(row)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 xl:hidden">
            {filtered.map((row) => (
              <article key={row.id} className="rounded-lg border border-[#F3E3D3] bg-white p-3 shadow-[0_16px_38px_rgba(58,43,39,0.06)] sm:p-4" onDoubleClick={() => start(row)}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8A7A0]/25 font-semibold text-[#3A2B27]">
                    {row.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="break-words text-left font-semibold text-[#2F2926]" onClick={() => start(row)}>
                      {row.full_name}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge value={row.guest_type} kind="type" />
                      <Badge value={row.invite_status} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#7A6F6B] sm:grid-cols-2">
                  <p className="min-w-0">
                    Telefone:{' '}
                    {row.phone ? (
                      <a className="inline-flex max-w-full items-center gap-1 break-all text-[#5f7f4d]" href={whatsappLink(row.phone)} target="_blank" rel="noreferrer">
                        <MessageCircle size={15} /> {row.phone}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                  <p className="min-w-0 break-words">Família: {groupById.get(row.group_id ?? '') ?? '-'}</p>
                  <p>Acompanhantes: {row.companions}</p>
                  <p className="min-w-0 break-words">Mesa: {tableById.get(row.table_id ?? '') ?? '-'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{renderActions(row)}</div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <GuestEmptyState onAdd={() => start()} />
      )}

      <Modal open={open} title={editing ? 'Editar convidado' : 'Novo convidado'} onClose={() => setOpen(false)}>
        <form className="-m-4 flex min-h-full flex-col sm:-m-5 sm:min-h-0" onSubmit={submit}>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24 sm:space-y-5 sm:p-5">
            <section className="rounded-lg border border-[#F3E3D3] bg-[#FFF8F6] p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-[#2F2926]">Dados principais</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
                <FormInput label="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                <FormInput label="Telefone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
                <FormSelect label="Família/grupo" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} options={[{ label: 'Sem família', value: '' }, ...groups.rows.map((g) => ({ label: g.name, value: g.id }))]} />
                <FormSelect label="Tipo" value={form.guest_type} onChange={(e) => setForm({ ...form, guest_type: e.target.value })} options={typeOptions.map((v) => ({ label: v, value: v }))} />
              </div>
            </section>

            <section className="rounded-lg border border-[#F3E3D3] bg-white p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-[#2F2926]">Detalhes do convite</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                <FormSelect label="Status do convite" value={form.invite_status} onChange={(e) => setForm({ ...form, invite_status: e.target.value })} options={statusOptions.map((v) => ({ label: v, value: v }))} />
                <FormInput label="Acompanhantes" type="number" min={0} value={form.companions} onChange={(e) => setForm({ ...form, companions: Number(e.target.value) })} />
                <FormSelect label="Mesa" value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })} options={[{ label: 'Sem mesa', value: '' }, ...tables.rows.map((t) => ({ label: t.name, value: t.id }))]} />
              </div>
            </section>

            <details className="rounded-lg border border-[#F3E3D3] bg-white p-3 sm:open:block sm:p-4" open={Boolean(editing)}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-[#2F2926]">Mais detalhes</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
                <FormInput label="Restrição alimentar" value={form.food_restriction} onChange={(e) => setForm({ ...form, food_restriction: e.target.value })} />
                <label className="flex items-center gap-2 self-end rounded-lg border border-[#F3E3D3] bg-[#FFF8F6] px-3 py-2 text-sm text-[#2F2926]">
                  <input type="checkbox" checked={form.gift_received} onChange={(e) => setForm({ ...form, gift_received: e.target.checked })} />
                  Presente recebido
                </label>
              </div>
              <div className="mt-4">
                <FormTextarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </details>
          </div>

          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-[#F3E3D3] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:flex sm:flex-wrap sm:justify-end sm:px-5 sm:py-4">
            <button type="button" className="btn-secondary border-[#F3E3D3] bg-white px-3 text-[#3A2B27] sm:px-4" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary bg-[#3A2B27] px-3 sm:px-4">Salvar convidado</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir convidado"
        message={`Tem certeza que deseja excluir ${deleting?.full_name ?? 'este convidado'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
