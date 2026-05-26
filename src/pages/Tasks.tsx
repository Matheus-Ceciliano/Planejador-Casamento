import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock3, Edit2, ExternalLink, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Task, TaskChecklistItem, Vendor } from '../types';
import { categoryToBudgetSlug } from '../utils/finance';
import { formatDate } from '../utils/format';

const blank = {
  title: '',
  description: '',
  category: 'Documentação',
  responsible: 'noiva',
  due_date: '',
  priority: 'média',
  status: 'pendente',
  vendor_id: '',
  budget_item_id: ''
};
const statuses = ['pendente', 'em andamento', 'concluída', 'atrasada'];
const priorities = ['baixa', 'média', 'alta'];
const responsibleOptions = ['noivo', 'noiva', 'cerimonialista'];
const taskCategories = ['Documentação', 'Igreja', 'Espaço', 'Buffet', 'Decoração', 'Roupas', 'Convidados', 'Fornecedores', 'Financeiro', 'Lua de mel', 'Outros'];
type MainTaskFilter = 'pending' | 'late' | 'done';

type DraftChecklistItem = {
  id?: string;
  title: string;
  is_completed: boolean;
};

const statusStyles: Record<string, string> = {
  pendente: 'bg-[#F3E3D3] text-[#7A6F6B] ring-[#ead5c1]',
  'em andamento': 'bg-[#D5A65A]/15 text-[#9a7436] ring-[#D5A65A]/25',
  concluída: 'bg-[#8FA87A]/15 text-[#5f7f4d] ring-[#8FA87A]/25',
  atrasada: 'bg-[#C97C7C]/15 text-[#a95757] ring-[#C97C7C]/25'
};

const priorityStyles: Record<string, string> = {
  baixa: 'bg-[#8FA87A]/12 text-[#5f7f4d] ring-[#8FA87A]/20',
  média: 'bg-[#F3E3D3] text-[#7A6F6B] ring-[#ead5c1]',
  alta: 'bg-[#C97C7C]/15 text-[#a95757] ring-[#C97C7C]/25'
};

function Badge({ value, kind }: { value: string; kind: 'status' | 'priority' }) {
  const styles = kind === 'status' ? statusStyles : priorityStyles;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${styles[value] ?? 'bg-stone-100 text-stone-600 ring-stone-200'}`}>{value}</span>;
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  active,
  onClick
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
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
          <p className={`mt-2 text-2xl font-semibold ${active ? 'text-white' : 'text-[#2F2926]'}`}>{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${active ? 'bg-white/12 text-white' : tone}`}>{icon}</span>
      </div>
    </button>
  );
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function isLate(task: Task) {
  const diff = daysUntil(task.due_date);
  return task.status !== 'concluída' && diff !== null && diff < 0;
}

function isPending(task: Task) {
  return ['pendente', 'em andamento'].includes(task.status) && !isLate(task);
}

function isDueSoon(task: Task) {
  const diff = daysUntil(task.due_date);
  return task.status !== 'concluída' && diff !== null && diff >= 0 && diff <= 2;
}

function priorityRank(priority: string) {
  return { alta: 0, média: 1, baixa: 2 }[priority] ?? 3;
}

function taskPayload(form: typeof blank): Partial<Task> {
  return {
    title: form.title,
    description: form.description || null,
    category: form.category,
    responsible: form.responsible,
    due_date: form.due_date || null,
    priority: form.priority,
    status: form.status,
    vendor_id: form.vendor_id || null,
    budget_item_id: form.budget_item_id || null
  };
}

export default function Tasks() {
  const navigate = useNavigate();
  const tasks = useWeddingTable<Task>('tasks', 'due_date');
  const checklist = useWeddingTable<TaskChecklistItem>('task_checklist_items', 'created_at');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [checklistDraft, setChecklistDraft] = useState<DraftChecklistItem[]>([]);
  const [deletedChecklistIds, setDeletedChecklistIds] = useState<string[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [mainFilter, setMainFilter] = useState<MainTaskFilter>('pending');
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState('due_date');

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor])), [vendors.rows]);
  const budgetItemById = useMemo(() => new Map(budgetItems.rows.map((item) => [item.id, item])), [budgetItems.rows]);

  const checklistByTaskId = useMemo(() => {
    const grouped = new Map<string, TaskChecklistItem[]>();
    checklist.rows.forEach((item) => {
      const items = grouped.get(item.task_id) ?? [];
      items.push(item);
      grouped.set(item.task_id, items);
    });
    return grouped;
  }, [checklist.rows]);

  const summary = useMemo(
    () => ({
      pending: tasks.rows.filter(isPending).length,
      late: tasks.rows.filter(isLate).length,
      done: tasks.rows.filter((task) => task.status === 'concluída').length
    }),
    [tasks.rows]
  );

  const rows = useMemo(() => {
    const filtered = tasks.rows.filter((task) => {
      const matchMainFilter =
        (mainFilter === 'pending' && isPending(task)) ||
        (mainFilter === 'late' && isLate(task)) ||
        (mainFilter === 'done' && task.status === 'concluída');

      return (
        matchMainFilter &&
        task.title.toLowerCase().includes(search.toLowerCase()) &&
        (!responsible || task.responsible === responsible) &&
        (!category || task.category === category) &&
        (!priority || task.priority === priority)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') return priorityRank(a.priority) - priorityRank(b.priority);
      if (sortBy === 'created_at') return String(b.created_at ?? b.id).localeCompare(String(a.created_at ?? a.id));
      return String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31'));
    });
  }, [category, mainFilter, priority, responsible, search, sortBy, tasks.rows]);

  const resultText = useMemo(() => {
    if (mainFilter === 'late') return `Mostrando ${rows.length} tarefas atrasadas`;
    if (mainFilter === 'done') return `Mostrando ${rows.length} tarefas concluídas`;
    return `Mostrando ${rows.length} tarefas pendentes`;
  }, [mainFilter, rows.length]);

  function getChecklistStats(taskId: string) {
    const items = checklistByTaskId.get(taskId) ?? [];
    const done = items.filter((item) => item.is_completed).length;
    const total = items.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { done, total, percent, items };
  }

  function start(row?: Task) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            ...blank,
            ...row,
            description: row.description ?? '',
            due_date: row.due_date ?? '',
            vendor_id: row.vendor_id ?? '',
            budget_item_id: row.budget_item_id ?? ''
          }
        : blank
    );
    setChecklistDraft(
      row
        ? (checklistByTaskId.get(row.id) ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            is_completed: item.is_completed
          }))
        : []
    );
    setDeletedChecklistIds([]);
    setNewChecklistTitle('');
    setOpen(true);
  }

  function addChecklistDraft() {
    const title = newChecklistTitle.trim();
    if (!title) return;
    setChecklistDraft((items) => [...items, { title, is_completed: false }]);
    setNewChecklistTitle('');
  }

  function removeChecklistDraft(index: number) {
    const item = checklistDraft[index];
    if (item?.id) setDeletedChecklistIds((ids) => [...ids, item.id as string]);
    setChecklistDraft((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  async function persistChecklist(taskId: string) {
    await Promise.all(deletedChecklistIds.map((id) => checklist.remove(id)));
    await Promise.all(
      checklistDraft
        .map((item) => ({ ...item, title: item.title.trim() }))
        .filter((item) => item.title)
        .map((item) =>
          item.id
            ? checklist.update(item.id, { title: item.title, is_completed: item.is_completed })
            : checklist.create({ task_id: taskId, title: item.title, is_completed: item.is_completed } as Partial<TaskChecklistItem>)
        )
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = taskPayload(form);
    if (editing) {
      await tasks.update(editing.id, payload);
      await persistChecklist(editing.id);
    } else {
      const created = await tasks.create(payload);
      await persistChecklist(created.id);
    }
    await checklist.refresh();
    setOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await tasks.remove(deleting.id);
    setDeleting(null);
  }

  function clearFilters() {
    setSearch('');
    setResponsible('');
    setCategory('');
    setPriority('');
    setSortBy('due_date');
    setMainFilter('pending');
  }

  function renderChecklistProgress(task: Task) {
    const stats = getChecklistStats(task.id);

    return (
      <div className="rounded-2xl bg-[#FFF8F6] px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#7A6F6B]">
          <span>Checklist</span>
          <span>{stats.done} de {stats.total} concluídas</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3E3D3]">
          <div className="h-full rounded-full bg-[#8FA87A] transition-all" style={{ width: `${stats.percent}%` }} />
        </div>
      </div>
    );
  }

  function renderLinkedRecords(task: Task) {
    const linkedVendor = task.vendor_id ? vendorById.get(task.vendor_id) : null;
    const linkedBudgetItem = task.budget_item_id ? budgetItemById.get(task.budget_item_id) : null;

    if (!linkedVendor && !linkedBudgetItem) return null;

    return (
      <div className="mt-5 border-t border-[#F3E3D3] pt-4">
        <h4 className="text-sm font-semibold text-[#2F2926]">Vínculos</h4>
        <div className="mt-3 grid gap-3">
          {linkedVendor && (
            <div className="rounded-2xl border border-[#F3E3D3] bg-white px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#7A6F6B]">Fornecedor vinculado</span>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#2F2926]">{linkedVendor.name}</p>
                <button className="btn-secondary h-8 px-2.5 text-xs" onClick={() => navigate('/fornecedores')}>
                  <ExternalLink size={14} /> Abrir fornecedor
                </button>
              </div>
              <p className="mt-1 text-xs text-[#7A6F6B]">{linkedVendor.category}</p>
            </div>
          )}
          {linkedBudgetItem && (
            <div className="rounded-2xl border border-[#F3E3D3] bg-white px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#7A6F6B]">Item financeiro vinculado</span>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#2F2926]">{linkedBudgetItem.name} - {linkedBudgetItem.category}</p>
                <button className="btn-secondary h-8 px-2.5 text-xs" onClick={() => navigate(`/orcamento/${categoryToBudgetSlug(linkedBudgetItem.category)}`)}>
                  <ExternalLink size={14} /> Abrir item financeiro
                </button>
              </div>
              <p className="mt-1 text-xs text-[#7A6F6B]">Status: {linkedBudgetItem.payment_status}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderTaskCard(task: Task) {
    const isOpen = expanded === task.id;
    const late = isLate(task);
    const dueSoon = isDueSoon(task);
    const stats = getChecklistStats(task.id);

    return (
      <article
        key={task.id}
        className={`flex h-full flex-col rounded-[1.75rem] border bg-white p-4 shadow-[0_14px_32px_rgba(58,43,39,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(58,43,39,0.09)] ${
          late ? 'border-[#C97C7C]/35 ring-1 ring-[#C97C7C]/10' : dueSoon ? 'border-[#D5A65A]/35 ring-1 ring-[#D5A65A]/10' : 'border-[#F3E3D3]'
        }`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={late ? 'atrasada' : task.status} kind="status" />
              <Badge value={task.priority} kind="priority" />
              {dueSoon && !late && <span className="inline-flex items-center gap-1 rounded-full bg-[#D5A65A]/15 px-2.5 py-1 text-xs font-semibold text-[#9a7436] ring-1 ring-[#D5A65A]/25"><Clock3 size={13} /> vence em breve</span>}
              {late && <span className="inline-flex items-center gap-1 rounded-full bg-[#C97C7C]/15 px-2.5 py-1 text-xs font-semibold text-[#a95757] ring-1 ring-[#C97C7C]/25"><AlertTriangle size={13} /> vencida</span>}
            </div>
            <h3 className="mt-3 line-clamp-2 min-h-[3rem] text-base font-semibold leading-snug text-[#2F2926]">{task.title}</h3>
            <div className="mt-2 grid gap-1 text-sm text-[#7A6F6B]">
              <span>Responsável: <strong className="font-semibold text-[#2F2926] capitalize">{task.responsible}</strong></span>
              <span>Prazo: <strong className={`font-semibold ${late ? 'text-[#a95757]' : dueSoon ? 'text-[#9a7436]' : 'text-[#2F2926]'}`}>{formatDate(task.due_date)}</strong></span>
            </div>
          </div>

          {renderChecklistProgress(task)}

          <div className="mt-auto flex flex-wrap gap-2">
            <button className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#8FA87A]/30 bg-[#8FA87A]/10 px-2.5 text-xs font-medium text-[#5f7f4d]" onClick={() => tasks.update(task.id, { status: 'concluída' })}>
              <Check size={14} /> Concluir
            </button>
            <button className="btn-secondary h-8 px-2.5 text-xs" onClick={() => setExpanded(isOpen ? null : task.id)}>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detalhes
            </button>
            <button className="btn-secondary h-8 px-2.5" onClick={() => start(task)} title="Editar">
              <Edit2 size={14} />
            </button>
            <button className="btn-secondary h-8 px-2.5" onClick={() => setDeleting(task)} title="Excluir">
              <Trash2 size={14} className="text-[#C97C7C]" />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 rounded-[1.5rem] border border-[#F3E3D3] bg-[#FFF8F6] p-4">
            <p className="text-sm text-[#7A6F6B]">{task.description || 'Sem descrição cadastrada.'}</p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-[#7A6F6B]">Categoria</span><p className="font-semibold text-[#2F2926]">{task.category}</p></div>
              <div><span className="text-[#7A6F6B]">Responsável</span><p className="font-semibold capitalize text-[#2F2926]">{task.responsible}</p></div>
              <div><span className="text-[#7A6F6B]">Prazo</span><p className="font-semibold text-[#2F2926]">{formatDate(task.due_date)}</p></div>
              <div><span className="text-[#7A6F6B]">Prioridade</span><p className="font-semibold capitalize text-[#2F2926]">{task.priority}</p></div>
              <div><span className="text-[#7A6F6B]">Status</span><p className="font-semibold capitalize text-[#2F2926]">{task.status}</p></div>
            </div>

            {renderLinkedRecords(task)}

            <div className="mt-5 border-t border-[#F3E3D3] pt-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#2F2926]">Checklist interno</h4>
                <span className="text-xs font-semibold text-[#7A6F6B]">{stats.done} de {stats.total} concluídas</span>
              </div>
              {stats.items.length ? (
                <div className="mt-3 space-y-2">
                  {stats.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-[#F3E3D3] bg-white px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#8FA87A]"
                        checked={item.is_completed}
                        onChange={() => checklist.update(item.id, { is_completed: !item.is_completed })}
                      />
                      <span className={`min-w-0 flex-1 text-sm ${item.is_completed ? 'text-[#7A6F6B] line-through' : 'text-[#2F2926]'}`}>{item.title}</span>
                      <button className="rounded-full p-1.5 text-[#C97C7C] transition hover:bg-[#C97C7C]/10" onClick={() => checklist.remove(item.id)} title="Excluir subtarefa">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-[#F3E3D3] bg-white px-3 py-3 text-sm text-[#7A6F6B]">Nenhuma subtarefa cadastrada.</p>
              )}
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#FFF8F6] text-[#2F2926]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-[#2F2926]">Tarefas</h1>
          <p className="mt-1 text-sm text-[#7A6F6B]">Checklist por responsável, prioridade e prazo.</p>
        </div>
        <button className="btn-primary bg-[#3A2B27]" onClick={() => start()}><Plus size={16} /> Nova tarefa</button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Pendentes"
          value={summary.pending}
          icon={<Clock3 size={18} />}
          tone="bg-[#F3E3D3] text-[#7A6F6B]"
          active={mainFilter === 'pending'}
          onClick={() => setMainFilter('pending')}
        />
        <SummaryCard
          label="Atrasadas"
          value={summary.late}
          icon={<AlertTriangle size={18} />}
          tone="bg-[#C97C7C]/15 text-[#a95757]"
          active={mainFilter === 'late'}
          onClick={() => setMainFilter('late')}
        />
        <SummaryCard
          label="Concluídas"
          value={summary.done}
          icon={<Check size={18} />}
          tone="bg-[#8FA87A]/15 text-[#5f7f4d]"
          active={mainFilter === 'done'}
          onClick={() => setMainFilter('done')}
        />
      </section>

      <section className="rounded-[1.5rem] border border-[#F3E3D3] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="label text-[#7A6F6B]">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D8A7A0]" size={18} />
              <input className="input border-[#F3E3D3] bg-[#FFF8F6] pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título da tarefa" />
            </div>
          </label>
          <FormSelect label="Responsável" value={responsible} onChange={(event) => setResponsible(event.target.value)} options={[{ label: 'Todos', value: '' }, ...responsibleOptions.map((value) => ({ label: value, value }))]} />
          <FormSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} options={[{ label: 'Todas', value: '' }, ...taskCategories.map((value) => ({ label: value, value }))]} />
          <FormSelect label="Prioridade" value={priority} onChange={(event) => setPriority(event.target.value)} options={[{ label: 'Todas', value: '' }, ...priorities.map((value) => ({ label: value, value }))]} />
          <FormSelect label="Ordenar" value={sortBy} onChange={(event) => setSortBy(event.target.value)} options={[{ label: 'Data limite', value: 'due_date' }, { label: 'Prioridade', value: 'priority' }, { label: 'Criação', value: 'created_at' }]} />
          <div className="flex items-end">
            <button className="btn-secondary w-full border-[#F3E3D3] bg-white text-[#3A2B27]" onClick={clearFilters}><X size={16} /> Limpar filtros</button>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#7A6F6B]">{resultText}</p>
      </section>

      {rows.length ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(renderTaskCard)}
        </section>
      ) : (
        <EmptyState icon={Check} title="Nenhuma tarefa encontrada" text="Crie uma tarefa ou ajuste os filtros da lista." />
      )}

      <Modal open={open} title={editing ? 'Editar tarefa' : 'Nova tarefa'} onClose={() => setOpen(false)}>
        <form className="space-y-5" onSubmit={submit}>
          <section className="rounded-[1.5rem] border border-[#F3E3D3] bg-[#FFF8F6] p-4">
            <h3 className="mb-4 text-sm font-semibold text-[#2F2926]">Dados da tarefa</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Título" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              <FormSelect label="Categoria" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={taskCategories.map((value) => ({ label: value, value }))} />
              <FormSelect label="Responsável" value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} options={responsibleOptions.map((value) => ({ label: value, value }))} />
              <FormInput label="Data limite" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
              <FormSelect label="Prioridade" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={priorities.map((value) => ({ label: value, value }))} />
              <FormSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={statuses.map((value) => ({ label: value, value }))} />
            </div>
            <div className="mt-4">
              <FormTextarea label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[#F3E3D3] bg-white p-4">
            <h3 className="mb-4 text-sm font-semibold text-[#2F2926]">Vínculos opcionais</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FormSelect
                label="Fornecedor relacionado"
                value={form.vendor_id}
                onChange={(event) => setForm({ ...form, vendor_id: event.target.value })}
                options={[{ label: 'Nenhum fornecedor', value: '' }, ...vendors.rows.map((vendor) => ({ label: `${vendor.name} - ${vendor.category}`, value: vendor.id }))]}
              />
              <FormSelect
                label="Item financeiro relacionado"
                value={form.budget_item_id}
                onChange={(event) => setForm({ ...form, budget_item_id: event.target.value })}
                options={[{ label: 'Nenhum item financeiro', value: '' }, ...budgetItems.rows.map((item) => ({ label: `${item.name} - ${item.category}`, value: item.id }))]}
              />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[#F3E3D3] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#2F2926]">Checklist interno</h3>
                <p className="mt-1 text-xs text-[#7A6F6B]">Adicione etapas menores para acompanhar esta tarefa.</p>
              </div>
              <span className="rounded-full bg-[#FFF8F6] px-3 py-1 text-xs font-semibold text-[#7A6F6B]">{checklistDraft.filter((item) => item.is_completed).length} de {checklistDraft.length} concluídas</span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1 border-[#F3E3D3] bg-[#FFF8F6]"
                value={newChecklistTitle}
                onChange={(event) => setNewChecklistTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addChecklistDraft();
                  }
                }}
                placeholder="Ex: Pedir orçamento"
              />
              <button type="button" className="btn-secondary shrink-0" onClick={addChecklistDraft}><Plus size={16} /> Adicionar</button>
            </div>

            {checklistDraft.length ? (
              <div className="mt-4 space-y-2">
                {checklistDraft.map((item, index) => (
                  <div key={item.id ?? `${item.title}-${index}`} className="flex items-center gap-2 rounded-2xl border border-[#F3E3D3] bg-[#FFF8F6] px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#8FA87A]"
                      checked={item.is_completed}
                      onChange={() => setChecklistDraft((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, is_completed: !current.is_completed } : current))}
                    />
                    <input
                      className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${item.is_completed ? 'text-[#7A6F6B] line-through' : 'text-[#2F2926]'}`}
                      value={item.title}
                      onChange={(event) => setChecklistDraft((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))}
                    />
                    <button type="button" className="rounded-full p-1.5 text-[#C97C7C] transition hover:bg-[#C97C7C]/10" onClick={() => removeChecklistDraft(index)} title="Remover subtarefa">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-[#F3E3D3] bg-[#FFF8F6] px-3 py-3 text-sm text-[#7A6F6B]">Nenhuma subtarefa adicionada.</p>
            )}
          </section>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-[#F3E3D3] bg-white px-6 py-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary bg-[#3A2B27]">Salvar tarefa</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir tarefa"
        message={`Tem certeza que deseja excluir ${deleting?.title ?? 'esta tarefa'}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
