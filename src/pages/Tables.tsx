import {
  ChevronDown,
  Edit2,
  LayoutGrid,
  Plus,
  Table2,
  Trash2,
  UserPlus,
  Users,
  XCircle
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ActionButton from '../components/ActionButton';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import AppSearchInput from '../components/ui/AppSearchInput';
import { useAuth } from '../hooks/useAuth';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { Guest, GuestGroup, TableGuest, WeddingMember, WeddingTable } from '../types';
import { formatFamilyDisplayName } from '../utils/format';

type ViewMode = 'families' | 'tables';
type AllocationFilter = 'all' | 'unassigned' | 'partial' | 'assigned';
type AllocationRequest = {
  guestIds: string[];
  tableId: string;
  label: string;
};

const blankTable = { name: '', capacity: 8, type: 'Outros', notes: '' };
const tableTypes = [
  'Mesa dos noivos',
  'Família da noiva',
  'Família do noivo',
  'Amigos',
  'Igreja',
  'Faculdade',
  'Trabalho',
  'Infantil',
  'Especial',
  'Outros'
];

function normalize(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isRefused(guest: Guest) {
  return normalize(guest.invite_status) === 'recusado';
}

function allocationStatus(total: number, allocated: number) {
  if (!total || allocated === 0) return 'unassigned' as const;
  if (allocated < total) return 'partial' as const;
  return 'assigned' as const;
}

function AllocationBadge({ total, allocated }: { total: number; allocated: number }) {
  const status = allocationStatus(total, allocated);
  const config = {
    unassigned: { label: 'Sem mesa', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    partial: { label: 'Parcialmente alocado', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
    assigned: { label: 'Alocado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${config.className}`}>{config.label}</span>;
}

function SummaryCard({ label, value, helper, tone = 'rose' }: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'rose' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    rose: 'bg-rose-50 text-w-rose ring-rose-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100'
  };
  return (
    <article className={`rounded-2xl p-3 ring-1 shadow-soft ${tones[tone]}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold opacity-75">{helper}</p>}
    </article>
  );
}

export default function Tables() {
  const { user } = useAuth();
  const guests = useWeddingTable<Guest>('guests', 'full_name');
  const groups = useWeddingTable<GuestGroup>('guest_groups', 'name');
  const tables = useWeddingTable<WeddingTable>('tables', 'name');
  const assignments = useWeddingTable<TableGuest>('table_guests', 'created_at');
  const members = useWeddingTable<WeddingMember>('wedding_members', 'name');

  const [view, setView] = useState<ViewMode>('families');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AllocationFilter>('all');
  const [originFilter, setOriginFilter] = useState('');
  const [tableOpen, setTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<WeddingTable | null>(null);
  const [tableForm, setTableForm] = useState(blankTable);
  const [savingTable, setSavingTable] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [allocationTitle, setAllocationTitle] = useState('');
  const [allocationGuests, setAllocationGuests] = useState<Guest[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [targetTableId, setTargetTableId] = useState('');
  const [pendingAllocation, setPendingAllocation] = useState<AllocationRequest | null>(null);
  const [allocationSubmitting, setAllocationSubmitting] = useState(false);
  const [removingAssignment, setRemovingAssignment] = useState<TableGuest | null>(null);
  const [deletingTable, setDeletingTable] = useState<WeddingTable | null>(null);
  const [clearingTable, setClearingTable] = useState<WeddingTable | null>(null);
  const [message, setMessage] = useState('');

  const currentMember = members.rows.find((member) => member.user_id === user?.id);
  const canEdit = Boolean(currentMember && currentMember.role !== 'viewer' && currentMember.can_edit !== false);
  const eligibleGuests = useMemo(() => guests.rows.filter((guest) => !isRefused(guest)), [guests.rows]);
  const assignmentByGuest = useMemo(
    () => new Map(assignments.rows.map((assignment) => [assignment.guest_id, assignment])),
    [assignments.rows]
  );
  const tableById = useMemo(() => new Map(tables.rows.map((table) => [table.id, table])), [tables.rows]);
  const guestsById = useMemo(() => new Map(guests.rows.map((guest) => [guest.id, guest])), [guests.rows]);
  const groupById = useMemo(() => new Map(groups.rows.map((group) => [group.id, group])), [groups.rows]);
  const assignmentsByTable = useMemo(() => {
    const result = new Map<string, TableGuest[]>();
    assignments.rows.forEach((assignment) => {
      result.set(assignment.table_id, [...(result.get(assignment.table_id) ?? []), assignment]);
    });
    return result;
  }, [assignments.rows]);
  const membersByGroup = useMemo(
    () => new Map(groups.rows.map((group) => [group.id, eligibleGuests.filter((guest) => guest.group_id === group.id)])),
    [eligibleGuests, groups.rows]
  );
  const individualGuests = useMemo(() => eligibleGuests.filter((guest) => !guest.group_id), [eligibleGuests]);

  const totalCapacity = tables.rows.reduce((sum, table) => sum + Number(table.capacity ?? 0), 0);
  const occupied = assignments.rows.filter((assignment) => guestsById.has(assignment.guest_id)).length;
  const confirmed = guests.rows.filter((guest) => normalize(guest.invite_status) === 'confirmado').length;
  const unassigned = eligibleGuests.filter((guest) => !assignmentByGuest.has(guest.id));
  const fullTables = tables.rows.filter((table) => (assignmentsByTable.get(table.id)?.length ?? 0) >= table.capacity);
  const originOptions = Array.from(new Set([
    ...groups.rows.map((group) => group.side),
    ...guests.rows.map((guest) => guest.origin_group ?? '')
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredGroups = groups.rows.filter((group) => {
    const familyGuests = membersByGroup.get(group.id) ?? [];
    const allocated = familyGuests.filter((guest) => assignmentByGuest.has(guest.id)).length;
    const status = allocationStatus(familyGuests.length, allocated);
    const displayName = formatFamilyDisplayName(group.responsible_name, group.name);
    const haystack = `${group.name} ${displayName} ${group.responsible_name ?? ''} ${group.side} ${familyGuests.map((guest) => guest.full_name).join(' ')}`;
    return (
      normalize(haystack).includes(normalize(search)) &&
      (filter === 'all' || filter === status) &&
      (!originFilter || normalize(group.side) === normalize(originFilter) || familyGuests.some((guest) => normalize(guest.origin_group) === normalize(originFilter)))
    );
  });

  const filteredTables = tables.rows.filter((table) => {
    const tableAssignments = assignmentsByTable.get(table.id) ?? [];
    const assignedGuests = tableAssignments.map((assignment) => guestsById.get(assignment.guest_id)).filter(Boolean) as Guest[];
    const familyNames = assignedGuests.map((guest) => {
      const group = guest.group_id ? groupById.get(guest.group_id) : null;
      return group ? formatFamilyDisplayName(group.responsible_name, group.name) : '';
    });
    const haystack = `${table.name} ${table.type} ${table.notes ?? ''} ${assignedGuests.map((guest) => guest.full_name).join(' ')} ${familyNames.join(' ')}`;
    const isFull = tableAssignments.length >= table.capacity;
    const occupancyStatus = tableAssignments.length === 0 ? 'unassigned' : isFull ? 'assigned' : 'partial';
    const originMatches = !originFilter || normalize(table.type) === normalize(originFilter) || assignedGuests.some((guest) => {
      const group = guest.group_id ? groupById.get(guest.group_id) : null;
      return normalize(guest.origin_group) === normalize(originFilter) || normalize(group?.side) === normalize(originFilter);
    });
    return normalize(haystack).includes(normalize(search)) && (filter === 'all' || filter === occupancyStatus) && originMatches;
  });

  function openNewTable() {
    setEditingTable(null);
    setTableForm(blankTable);
    setTableOpen(true);
    setMessage('');
  }

  function openEditTable(table: WeddingTable) {
    setEditingTable(table);
    setTableForm({ name: table.name, capacity: table.capacity, type: table.type || 'Outros', notes: table.notes ?? '' });
    setTableOpen(true);
    setMessage('');
  }

  async function saveTable(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || savingTable || !tableForm.name.trim() || tableForm.capacity <= 0) return;
    const occupiedSeats = editingTable ? assignmentsByTable.get(editingTable.id)?.length ?? 0 : 0;
    if (tableForm.capacity < occupiedSeats) {
      setMessage(`A capacidade não pode ser menor que os ${occupiedSeats} lugares ocupados.`);
      return;
    }

    setSavingTable(true);
    try {
      const payload = {
        name: tableForm.name.trim(),
        capacity: Number(tableForm.capacity),
        type: tableForm.type,
        notes: tableForm.notes.trim() || null
      };
      if (editingTable) await tables.update(editingTable.id, payload);
      else await tables.create(payload as Partial<WeddingTable>);
      setTableOpen(false);
      setMessage(editingTable ? 'Mesa atualizada com sucesso.' : 'Mesa criada com sucesso.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Não foi possível salvar a mesa.';
      setMessage(text.includes('tables_wedding_name_unique') ? 'Já existe uma mesa com esse nome.' : text);
    } finally {
      setSavingTable(false);
    }
  }

  function openAllocation(title: string, availableGuests: Guest[], initiallySelected: string[] = []) {
    if (!canEdit) return;
    const eligible = availableGuests.filter((guest) => !isRefused(guest));
    setAllocationTitle(title);
    setAllocationGuests(eligible);
    setSelectedGuestIds(new Set(initiallySelected));
    setTargetTableId('');
    setAllocationOpen(true);
    setMessage('');
  }

  function openFamilyAllocation(group: GuestGroup, selectAll: boolean) {
    const familyGuests = membersByGroup.get(group.id) ?? [];
    const selectable = familyGuests.filter((guest) => !isRefused(guest));
    const familyName = formatFamilyDisplayName(group.responsible_name, group.name);
    openAllocation(
      selectAll ? `Alocar ${familyName}` : `Alocar membros de ${familyName}`,
      selectable,
      selectAll ? selectable.map((guest) => guest.id) : []
    );
  }

  function requestAllocation(event: FormEvent) {
    event.preventDefault();
    if (!targetTableId || selectedGuestIds.size === 0) return;
    const target = tableById.get(targetTableId);
    if (!target) return;
    const movingFromTarget = Array.from(selectedGuestIds).filter(
      (guestId) => assignmentByGuest.get(guestId)?.table_id === targetTableId
    ).length;
    const occupiedSeats = assignmentsByTable.get(targetTableId)?.length ?? 0;
    const requiredSeats = selectedGuestIds.size - movingFromTarget;
    const freeSeats = Math.max(0, target.capacity - occupiedSeats);
    if (requiredSeats > freeSeats) {
      setMessage(`Essa mesa possui apenas ${freeSeats} lugar${freeSeats === 1 ? '' : 'es'} livre${freeSeats === 1 ? '' : 's'}, mas você está tentando adicionar ${requiredSeats}.`);
      return;
    }
    setPendingAllocation({
      guestIds: Array.from(selectedGuestIds),
      tableId: targetTableId,
      label: `${selectedGuestIds.size} convidado${selectedGuestIds.size === 1 ? '' : 's'} em ${target.name}`
    });
  }

  async function confirmAllocation() {
    if (!pendingAllocation || allocationSubmitting) return;
    setAllocationSubmitting(true);
    try {
      const { error } = await supabase.rpc('assign_guests_to_table', {
        target_table_id: pendingAllocation.tableId,
        target_guest_ids: pendingAllocation.guestIds
      });
      if (error) throw error;
      await assignments.refresh();
      setPendingAllocation(null);
      setAllocationOpen(false);
      setMessage('Alocação atualizada com sucesso.');
    } finally {
      setAllocationSubmitting(false);
    }
  }

  async function confirmRemoveAssignment() {
    if (!removingAssignment || allocationSubmitting) return;
    setAllocationSubmitting(true);
    try {
      await assignments.remove(removingAssignment.id);
      setRemovingAssignment(null);
      setMessage('Convidado removido da mesa.');
    } finally {
      setAllocationSubmitting(false);
    }
  }

  async function confirmClearTable() {
    if (!clearingTable || allocationSubmitting) return;
    setAllocationSubmitting(true);
    try {
      const currentAssignments = assignmentsByTable.get(clearingTable.id) ?? [];
      for (const assignment of currentAssignments) await assignments.remove(assignment.id);
      setClearingTable(null);
      setMessage('Todas as alocações da mesa foram removidas.');
    } finally {
      setAllocationSubmitting(false);
    }
  }

  async function confirmDeleteTable() {
    if (!deletingTable || allocationSubmitting) return;
    setAllocationSubmitting(true);
    try {
      await tables.remove(deletingTable.id);
      setDeletingTable(null);
      setMessage('Mesa excluída com sucesso.');
    } finally {
      setAllocationSubmitting(false);
    }
  }

  function toggleFamily(groupId: string) {
    setExpandedFamilies((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="space-y-5 pb-28 text-w-text lg:pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-w-faint">Organização de lugares</p>
          <h1 className="page-title mt-1">Mesas</h1>
          <p className="mt-1 text-sm text-w-muted">Distribua famílias e convidados nas mesas do casamento.</p>
        </div>
        <button type="button" className="btn-primary min-h-11 justify-center" onClick={openNewTable} disabled={!canEdit}>
          <Plus size={16} /> Nova mesa
        </button>
      </header>

      {message && <div className="rounded-2xl border border-w-border bg-white px-4 py-3 text-sm font-semibold text-w-muted shadow-soft">{message}</div>}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Mesas criadas" value={tables.rows.length} />
        <SummaryCard label="Lugares totais" value={totalCapacity} />
        <SummaryCard label="Ocupados" value={`${occupied}/${totalCapacity}`} tone="green" />
        <SummaryCard label="Confirmados" value={confirmed} tone="green" />
        <SummaryCard label="Sem mesa" value={unassigned.length} tone="amber" />
        <SummaryCard label="Mesas lotadas" value={fullTables.length} tone={fullTables.length ? 'red' : 'green'} />
      </section>

      <section className="grid gap-3 rounded-3xl border border-w-border bg-white p-3 shadow-soft lg:grid-cols-[auto_minmax(260px,1fr)_180px_180px] lg:items-end">
        <div className="flex rounded-2xl bg-w-surface p-1">
          <button type="button" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${view === 'families' ? 'bg-w-rose text-white shadow-rose' : 'text-w-muted'}`} onClick={() => setView('families')}>
            <Users size={15} /> Por família
          </button>
          <button type="button" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${view === 'tables' ? 'bg-w-rose text-white shadow-rose' : 'text-w-muted'}`} onClick={() => setView('tables')}>
            <LayoutGrid size={15} /> Por mesa
          </button>
        </div>
        <AppSearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch('')} placeholder="Buscar convidado, família ou mesa..." />
        <FormSelect
          label="Alocação"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AllocationFilter)}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Sem mesa', value: 'unassigned' },
            { label: 'Parcialmente alocados', value: 'partial' },
            { label: view === 'tables' ? 'Mesas lotadas' : 'Alocados', value: 'assigned' }
          ]}
        />
        <FormSelect label="Origem" value={originFilter} onChange={(event) => setOriginFilter(event.target.value)} options={[{ label: 'Todas', value: '' }, ...originOptions.map((value) => ({ label: value, value }))]} />
      </section>

      {unassigned.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold text-amber-900">Convidados sem mesa</p>
              <p className="mt-1 text-sm text-amber-700">{unassigned.length} convidado{unassigned.length === 1 ? '' : 's'} confirmado{unassigned.length === 1 ? '' : 's'} ou pendente{unassigned.length === 1 ? '' : 's'} ainda precisa{unassigned.length === 1 ? '' : 'm'} ser organizado{unassigned.length === 1 ? '' : 's'}.</p>
            </div>
            <button type="button" className="btn-secondary border-amber-300 bg-white text-amber-800" onClick={() => openAllocation('Alocar convidados sem mesa', unassigned)} disabled={!canEdit}>
              <UserPlus size={15} /> Alocar agora
            </button>
          </div>
        </section>
      )}

      {view === 'families' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredGroups.map((group) => {
            const familyGuests = membersByGroup.get(group.id) ?? [];
            const allocated = familyGuests.filter((guest) => assignmentByGuest.has(guest.id)).length;
            const confirmedCount = familyGuests.filter((guest) => normalize(guest.invite_status) === 'confirmado').length;
            const pendingCount = familyGuests.filter((guest) => !['confirmado', 'recusado'].includes(normalize(guest.invite_status))).length;
            const refusedCount = guests.rows.filter((guest) => guest.group_id === group.id && isRefused(guest)).length;
            const isExpanded = expandedFamilies.has(group.id);
            return (
              <article key={group.id} className="overflow-hidden rounded-3xl border border-w-border bg-white shadow-card">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-extrabold">{formatFamilyDisplayName(group.responsible_name, group.name)}</h2>
                        <AllocationBadge total={familyGuests.length} allocated={allocated} />
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-w-muted">Responsável: {group.responsible_name || 'Não definido'}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-w-faint">{group.side || 'Outros'}</p>
                    </div>
                    <span className="rounded-2xl bg-w-surface px-3 py-2 text-sm font-extrabold text-w-rose">{allocated}/{familyGuests.length}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Convidados', familyGuests.length],
                      ['Confirmados', confirmedCount],
                      ['Pendentes', pendingCount],
                      ['Recusados', refusedCount]
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-w-surface p-2">
                        <strong className="block text-sm text-w-text">{value}</strong>
                        <span className="text-[9px] font-bold uppercase text-w-faint">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button type="button" className="btn-secondary justify-center text-xs" onClick={() => toggleFamily(group.id)}>
                      <ChevronDown size={14} className={isExpanded ? 'rotate-180' : ''} /> Ver membros
                    </button>
                    <button type="button" className="btn-secondary justify-center text-xs" onClick={() => openFamilyAllocation(group, true)} disabled={!canEdit || familyGuests.length === 0}>
                      <Users size={14} /> Família inteira
                    </button>
                    <button type="button" className="btn-primary justify-center text-xs" onClick={() => openFamilyAllocation(group, false)} disabled={!canEdit || familyGuests.length === 0}>
                      <UserPlus size={14} /> Selecionar membros
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-2 border-t border-w-border bg-w-surface/60 p-3">
                    {familyGuests.map((guest) => {
                      const assignment = assignmentByGuest.get(guest.id);
                      const table = assignment ? tableById.get(assignment.table_id) : null;
                      return (
                        <div key={guest.id} className="flex flex-col gap-2 rounded-2xl border border-w-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold">{guest.full_name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-w-muted">{guest.invite_status} · {table?.name ?? 'Sem mesa'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className="btn-secondary min-h-8 px-2 text-xs" onClick={() => openAllocation(`Alocar ${guest.full_name}`, [guest], [guest.id])} disabled={!canEdit}>
                              {assignment ? 'Mover' : 'Alocar'}
                            </button>
                            {assignment && <button type="button" className="btn-secondary min-h-8 px-2 text-xs text-red-600" onClick={() => setRemovingAssignment(assignment)} disabled={!canEdit}>Remover</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          {individualGuests.length > 0 && !search && filter === 'all' && (
            <article className="rounded-3xl border border-dashed border-w-border-md bg-white p-4 shadow-soft">
              <h2 className="text-lg font-extrabold">Convidados individuais</h2>
              <p className="mt-1 text-sm text-w-muted">{individualGuests.length} convidado{individualGuests.length === 1 ? '' : 's'} sem família cadastrada.</p>
              <button type="button" className="btn-primary mt-4" onClick={() => openAllocation('Alocar convidados individuais', individualGuests)} disabled={!canEdit}>
                <UserPlus size={15} /> Selecionar convidados
              </button>
            </article>
          )}

          {!filteredGroups.length && <EmptyState icon={Users} title="Nenhuma família encontrada" text="Ajuste os filtros ou cadastre famílias na aba Convidados." />}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTables.map((table) => {
            const tableAssignments = assignmentsByTable.get(table.id) ?? [];
            const assignedGuests = tableAssignments.map((assignment) => guestsById.get(assignment.guest_id)).filter(Boolean) as Guest[];
            const free = Math.max(0, table.capacity - assignedGuests.length);
            const percentage = table.capacity ? Math.min(100, Math.round((assignedGuests.length / table.capacity) * 100)) : 0;
            const families = Array.from(new Set(assignedGuests.map((guest) => guest.group_id ? groupById.get(guest.group_id)?.name : 'Individuais').filter(Boolean)));
            const progressTone = percentage >= 100 ? 'bg-w-rose' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500';
            const statusLabel = percentage >= 100 ? 'Lotada' : percentage > 70 ? 'Quase cheia' : 'Disponível';
            return (
              <article key={table.id} className="rounded-3xl border border-w-border bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-extrabold">{table.name}</h2>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${percentage >= 100 ? 'bg-rose-50 text-w-rose' : percentage > 70 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-w-faint">{table.type || 'Outros'}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="rounded-xl p-2 text-w-muted hover:bg-w-surface" onClick={() => openEditTable(table)} disabled={!canEdit} aria-label="Editar mesa"><Edit2 size={15} /></button>
                    <button type="button" className="rounded-xl p-2 text-red-500 hover:bg-red-50" onClick={() => setDeletingTable(table)} disabled={!canEdit} aria-label="Excluir mesa"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-extrabold">{assignedGuests.length}/{table.capacity}</p>
                    <p className="text-xs font-semibold text-w-muted">lugares ocupados</p>
                  </div>
                  <p className="text-sm font-bold text-w-muted">{free} livre{free === 1 ? '' : 's'}</p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-w-border">
                  <div className={`h-full rounded-full transition-all ${progressTone}`} style={{ width: `${percentage}%` }} />
                </div>
                {families.length > 0 && <p className="mt-3 text-xs font-semibold text-w-muted">Famílias: {families.join(', ')}</p>}
                <div className="mt-4 space-y-2">
                  {assignedGuests.map((guest) => {
                    const assignment = assignmentByGuest.get(guest.id);
                    return (
                      <div key={guest.id} className="flex items-center justify-between gap-2 rounded-xl bg-w-surface px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{guest.full_name}</p>
                          <p className="truncate text-[11px] text-w-faint">
                            {guest.group_id
                              ? (() => {
                                  const group = groupById.get(guest.group_id);
                                  return group ? formatFamilyDisplayName(group.responsible_name, group.name) : 'Família';
                                })()
                              : 'Individual'}
                          </p>
                        </div>
                        {assignment && <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => setRemovingAssignment(assignment)} disabled={!canEdit} aria-label={`Remover ${guest.full_name}`}><XCircle size={15} /></button>}
                      </div>
                    );
                  })}
                  {!assignedGuests.length && <p className="rounded-xl border border-dashed border-w-border p-3 text-center text-sm text-w-muted">Nenhum convidado alocado.</p>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-primary justify-center text-xs" onClick={() => { openAllocation(`Adicionar em ${table.name}`, eligibleGuests); setTargetTableId(table.id); }} disabled={!canEdit || free <= 0}>
                    <UserPlus size={14} /> Adicionar
                  </button>
                  <button type="button" className="btn-secondary justify-center text-xs" onClick={() => setClearingTable(table)} disabled={!canEdit || !assignedGuests.length}>
                    Limpar mesa
                  </button>
                </div>
              </article>
            );
          })}
          {!filteredTables.length && <EmptyState icon={Table2} title="Nenhuma mesa encontrada" text="Crie uma mesa ou ajuste os filtros de busca." />}
        </section>
      )}

      <Modal open={tableOpen} title={editingTable ? 'Editar mesa' : 'Nova mesa'} busy={savingTable} onClose={() => setTableOpen(false)}>
        <form className="space-y-4" onSubmit={saveTable}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Nome da mesa" value={tableForm.name} onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })} required />
            <FormInput label="Capacidade" type="number" min="1" value={tableForm.capacity} onChange={(event) => setTableForm({ ...tableForm, capacity: Number(event.target.value) })} required />
            <div className="sm:col-span-2">
              <FormSelect label="Tipo da mesa" value={tableForm.type} onChange={(event) => setTableForm({ ...tableForm, type: event.target.value })} options={tableTypes.map((value) => ({ label: value, value }))} />
            </div>
          </div>
          <FormTextarea label="Observação" value={tableForm.notes} onChange={(event) => setTableForm({ ...tableForm, notes: event.target.value })} placeholder="Ex: família da noiva, próxima ao palco..." />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setTableOpen(false)} disabled={savingTable}>Cancelar</button>
            <ActionButton type="submit" className="btn-primary" loading={savingTable} loadingText="Salvando...">Salvar mesa</ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={allocationOpen} title={allocationTitle || 'Alocar convidados'} busy={allocationSubmitting} onClose={() => setAllocationOpen(false)}>
        <form className="space-y-4" onSubmit={requestAllocation}>
          <FormSelect
            label="Mesa de destino"
            value={targetTableId}
            onChange={(event) => setTargetTableId(event.target.value)}
            options={[
              { label: 'Selecione uma mesa', value: '' },
              ...tables.rows.map((table) => {
                const used = assignmentsByTable.get(table.id)?.length ?? 0;
                const free = Math.max(0, table.capacity - used);
                return { label: `${table.name} — ${used}/${table.capacity} ocupados — ${free ? `${free} livres` : 'lotada'}`, value: table.id, disabled: free <= 0 };
              })
            ]}
          />
          <div className="max-h-[46vh] space-y-2 overflow-y-auto rounded-2xl bg-w-surface p-3">
            {allocationGuests.map((guest) => {
              const assignment = assignmentByGuest.get(guest.id);
              const currentTable = assignment ? tableById.get(assignment.table_id) : null;
              const checked = selectedGuestIds.has(guest.id);
              return (
                <label key={guest.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-w-border bg-white p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setSelectedGuestIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(guest.id);
                      else next.delete(guest.id);
                      return next;
                    })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{guest.full_name}</p>
                    <p className="truncate text-xs font-semibold text-w-muted">{guest.invite_status} · {currentTable ? `Mesa atual: ${currentTable.name}` : 'Sem mesa'}</p>
                  </div>
                  {currentTable && <span className="text-[10px] font-bold uppercase text-amber-700">Mover</span>}
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-w-muted">{selectedGuestIds.size} selecionado{selectedGuestIds.size === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAllocationOpen(false)} disabled={allocationSubmitting}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={!targetTableId || selectedGuestIds.size === 0}>Continuar</button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingAllocation)}
        title="Confirmar alocação?"
        description="Convidados já alocados serão movidos para a mesa selecionada."
        confirmLabel="Sim, alocar"
        loadingLabel="Alocando..."
        variant="success"
        loading={allocationSubmitting}
        details={pendingAllocation ? [{ label: 'Alocação', value: pendingAllocation.label }] : undefined}
        onCancel={() => setPendingAllocation(null)}
        onConfirm={confirmAllocation}
      />
      <ConfirmDialog
        open={Boolean(removingAssignment)}
        title="Remover convidado da mesa?"
        description="O convidado voltará para a lista de pessoas sem mesa."
        confirmLabel="Sim, remover"
        loading={allocationSubmitting}
        details={removingAssignment ? [{ label: 'Convidado', value: guestsById.get(removingAssignment.guest_id)?.full_name ?? 'Convidado' }] : undefined}
        onCancel={() => setRemovingAssignment(null)}
        onConfirm={confirmRemoveAssignment}
      />
      <ConfirmDialog
        open={Boolean(clearingTable)}
        title="Remover todas as alocações?"
        description="Todos os convidados desta mesa voltarão para a lista de pessoas sem mesa."
        confirmLabel="Sim, remover todos"
        loading={allocationSubmitting}
        details={clearingTable ? [{ label: 'Mesa', value: clearingTable.name }, { label: 'Convidados', value: assignmentsByTable.get(clearingTable.id)?.length ?? 0 }] : undefined}
        onCancel={() => setClearingTable(null)}
        onConfirm={confirmClearTable}
      />
      <ConfirmDialog
        open={Boolean(deletingTable)}
        title="Excluir mesa?"
        description="A mesa será excluída e suas alocações serão removidas."
        confirmLabel="Sim, excluir"
        loading={allocationSubmitting}
        details={deletingTable ? [{ label: 'Mesa', value: deletingTable.name }, { label: 'Ocupação', value: `${assignmentsByTable.get(deletingTable.id)?.length ?? 0}/${deletingTable.capacity}` }] : undefined}
        onCancel={() => setDeletingTable(null)}
        onConfirm={confirmDeleteTable}
      />
    </div>
  );
}
