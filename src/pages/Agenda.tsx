import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Heart,
  List,
  ListTodo,
  MapPin,
  Plus,
  Receipt,
  User,
  WalletCards
} from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetCategory, BudgetItem, Task, Vendor } from '../types';
import { budgetCategories } from '../utils/constants';
import { formatMoney } from '../utils/format';

type TimelineItem = {
  id: string;
  wedding_id: string;
  time: string;
  activity: string;
  responsible: string | null;
  place: string | null;
  notes: string | null;
};

type AgendaType = 'task' | 'event' | 'payment' | 'reminder';
type ViewMode = 'list' | 'calendar';
type PeriodFilter = 'all' | 'today' | 'week' | 'overdue';
type TypeFilter = 'all' | AgendaType;
type AgendaSource = 'task' | 'budget' | 'timeline' | 'wedding';

type AgendaItem = {
  id: string;
  sourceId: string;
  source: AgendaSource;
  date: string;
  time?: string | null;
  type: AgendaType;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  responsible?: string | null;
  priority?: string | null;
  status: string;
  amount?: number;
  href: string;
};

type AgendaForm = {
  title: string;
  type: AgendaType;
  date: string;
  time: string;
  location: string;
  category: string;
  priority: string;
  responsible: string;
  description: string;
  status: string;
  vendor_id: string;
  budget_item_id: string;
  amount: number;
};

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const typeLabels: Record<AgendaType, string> = {
  task: 'Tarefa',
  event: 'Evento',
  payment: 'Vencimento',
  reminder: 'Lembrete'
};
const periodLabels: Record<PeriodFilter, string> = {
  all: 'Todos',
  today: 'Hoje',
  week: '7 dias',
  overdue: 'Atrasados'
};
const taskCategories = ['Documentação', 'Igreja', 'Espaço', 'Buffet', 'Decoração', 'Roupas', 'Convidados', 'Fornecedores', 'Financeiro', 'Lua de mel', 'Outros'];
const priorities = ['baixa', 'média', 'alta'];
const responsibleOptions = ['noiva', 'noivo', 'cerimonialista'];
const statusesByType: Record<AgendaType, string[]> = {
  task: ['pendente', 'em andamento', 'concluída', 'atrasada'],
  event: ['agendado', 'realizado', 'cancelado'],
  payment: ['pendente', 'pago', 'vencido'],
  reminder: ['pendente', 'concluída']
};

const blankForm: AgendaForm = {
  title: '',
  type: 'task',
  date: '',
  time: '',
  location: '',
  category: 'Documentação',
  priority: 'média',
  responsible: 'noiva',
  description: '',
  status: 'pendente',
  vendor_id: '',
  budget_item_id: '',
  amount: 0
};

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

function longDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(dateFromKey(value));
}

function compactDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' }).format(dateFromKey(value));
}

function numericDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(dateFromKey(value));
}

function daysBetween(from: string, to: string): number {
  const start = dateFromKey(from);
  const end = dateFromKey(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function sameMonth(value: string, month: Date): boolean {
  const date = dateFromKey(value);
  return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
}

function buildMonthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function agendaTypeFromTask(task: Task): AgendaType {
  if (task.category === 'Evento') return 'event';
  if (task.category === 'Lembrete') return 'reminder';
  return 'task';
}

function statusForItem(item: AgendaItem, today: string) {
  if (item.type === 'payment' && item.date < today && !['pago', 'cancelado'].includes(item.status)) return 'vencido';
  if ((item.type === 'task' || item.type === 'reminder') && item.date < today && item.status !== 'concluída') return 'atrasada';
  return item.status;
}

function typeDotColor(type: AgendaType) {
  return {
    task: 'bg-[#F59E0B]',
    event: 'bg-[#E11D48]',
    payment: 'bg-[#EF4444]',
    reminder: 'bg-[#22C55E]'
  }[type];
}

function typeTone(type: AgendaType) {
  return {
    task: 'border-amber-100 bg-amber-50/70 text-amber-800',
    event: 'border-rose-100 bg-rose-50/80 text-rose-800',
    payment: 'border-red-100 bg-red-50/80 text-red-800',
    reminder: 'border-green-100 bg-green-50/80 text-green-800'
  }[type];
}

function typeIcon(type: AgendaType) {
  return { task: ListTodo, event: CalendarClock, payment: WalletCards, reminder: AlertTriangle }[type];
}

function nextStatus(type: AgendaType, current: string) {
  if (type === 'payment') return current === 'pago' ? 'pendente' : 'pago';
  if (type === 'event') return current === 'realizado' ? 'agendado' : 'realizado';
  return current === 'concluída' ? 'pendente' : 'concluída';
}

function formForDate(date: string, type: AgendaType = 'task'): AgendaForm {
  return { ...blankForm, type, date, category: type === 'payment' ? 'Outros' : type === 'event' ? 'Evento' : type === 'reminder' ? 'Lembrete' : 'Documentação', status: statusesByType[type][0] };
}

export default function Agenda() {
  const { wedding } = useWedding();
  const tasks = useWeddingTable<Task>('tasks', 'due_date');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const budgetCategoryRows = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const timeline = useWeddingTable<TimelineItem>('timeline_items', 'time');

  const today = dateKey(new Date());
  const in7Days = dateKey(addDays(new Date(), 7));
  const in30Days = dateKey(addDays(new Date(), 30));
  const [view, setView] = useState<ViewMode>('list');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [month, setMonth] = useState(() => {
    const base = wedding?.wedding_date ? dateFromKey(wedding.wedding_date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState<AgendaForm>(() => formForDate(today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = useMemo(() => {
    const names = budgetCategoryRows.rows.length ? budgetCategoryRows.rows.map((item) => item.name) : budgetCategories;
    return Array.from(new Set([...names, 'Outros']));
  }, [budgetCategoryRows.rows]);

  const vendorById = useMemo(() => new Map(vendors.rows.map((vendor) => [vendor.id, vendor])), [vendors.rows]);

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];

    tasks.rows
      .filter((task) => task.due_date)
      .forEach((task) => {
        const type = agendaTypeFromTask(task);
        const linkedVendor = task.vendor_id ? vendorById.get(task.vendor_id) : null;
        items.push({
          id: `task-${task.id}`,
          sourceId: task.id,
          source: 'task',
          date: task.due_date as string,
          type,
          title: task.title,
          description: task.description,
          category: task.category,
          responsible: task.responsible,
          priority: task.priority,
          status: task.status,
          location: linkedVendor?.contact_name ?? null,
          href: '/agenda'
        });
      });

    budgetItems.rows
      .filter((item) => item.due_date)
      .forEach((item) => {
        const pending = Number(item.contracted_value ?? 0) - Number(item.paid_value ?? 0);
        const linkedVendor = item.vendor_id ? vendorById.get(item.vendor_id) : null;
        items.push({
          id: `payment-${item.id}`,
          sourceId: item.id,
          source: 'budget',
          date: item.due_date as string,
          type: 'payment',
          title: item.name,
          description: item.description || `${item.category} · ${formatMoney(Math.max(0, pending))} pendente`,
          category: item.category,
          status: item.payment_status,
          amount: Number(item.contracted_value ?? 0),
          location: linkedVendor?.name ?? null,
          href: '/orcamento'
        });
      });

    if (wedding?.wedding_date) {
      items.push({
        id: `wedding-${wedding.id}`,
        sourceId: wedding.id,
        source: 'wedding',
        date: wedding.wedding_date,
        time: wedding.ceremony_time,
        type: 'event',
        title: wedding.name || 'Casamento',
        description: [wedding.ceremony_place, wedding.party_place].filter(Boolean).join(' · '),
        location: wedding.ceremony_place,
        status: 'agendado',
        href: '/configuracoes'
      });

      timeline.rows.forEach((item) => {
        items.push({
          id: `timeline-${item.id}`,
          sourceId: item.id,
          source: 'timeline',
          date: wedding.wedding_date as string,
          time: item.time,
          type: 'event',
          title: item.activity,
          description: item.notes,
          responsible: item.responsible,
          location: item.place,
          status: 'agendado',
          href: '/cronograma'
        });
      });
    }

    return items.sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`, 'pt-BR', { numeric: true }));
  }, [budgetItems.rows, tasks.rows, timeline.rows, vendorById, wedding]);

  const visibleItems = useMemo(() => {
    return agendaItems.filter((item) => {
      const currentStatus = statusForItem(item, today);
      const periodMatch =
        periodFilter === 'all' ||
        (periodFilter === 'today' && item.date === today) ||
        (periodFilter === 'week' && item.date > today && item.date <= in7Days) ||
        (periodFilter === 'overdue' && ['atrasada', 'vencido'].includes(currentStatus));
      const typeMatch = typeFilter === 'all' || item.type === typeFilter;
      return periodMatch && typeMatch;
    });
  }, [agendaItems, in7Days, periodFilter, today, typeFilter]);

  const counts = useMemo(() => ({
    all: agendaItems.length,
    today: agendaItems.filter((item) => item.date === today).length,
    week: agendaItems.filter((item) => item.date > today && item.date <= in7Days).length,
    overdue: agendaItems.filter((item) => ['atrasada', 'vencido'].includes(statusForItem(item, today))).length,
    task: agendaItems.filter((item) => item.type === 'task').length,
    event: agendaItems.filter((item) => item.type === 'event').length,
    payment: agendaItems.filter((item) => item.type === 'payment').length,
    reminder: agendaItems.filter((item) => item.type === 'reminder').length
  }), [agendaItems, in7Days, today]);

  const groups = useMemo(() => {
    if (periodFilter !== 'all') return null;
    return [
      { label: 'Hoje', items: visibleItems.filter((item) => item.date === today), accent: 'text-[#E11D48]' },
      { label: 'Próximos 7 dias', items: visibleItems.filter((item) => item.date > today && item.date <= in7Days), accent: 'text-[#F59E0B]' },
      { label: 'Próximos 30 dias', items: visibleItems.filter((item) => item.date > in7Days && item.date <= in30Days), accent: 'text-[#1F2937]' },
      { label: 'Atrasados', items: visibleItems.filter((item) => ['atrasada', 'vencido'].includes(statusForItem(item, today))), accent: 'text-[#EF4444]' }
    ].filter((group) => group.items.length);
  }, [in30Days, in7Days, periodFilter, today, visibleItems]);

  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const calendarItems = useMemo(() => visibleItems.filter((item) => sameMonth(item.date, month)), [month, visibleItems]);
  const itemsByDate = useMemo(() => calendarItems.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    acc[item.date] = [...(acc[item.date] ?? []), item];
    return acc;
  }, {}), [calendarItems]);
  const selectedItems = selectedDay ? (itemsByDate[selectedDay] ?? []) : [];
  const nextCommitment = useMemo(
    () => agendaItems.find((item) => item.date >= today && item.type !== 'payment' && !['concluída', 'cancelado'].includes(item.status)),
    [agendaItems, today]
  );
  const nextPayment = useMemo(
    () => agendaItems.find((item) => item.date >= today && item.type === 'payment' && statusForItem(item, today) !== 'pago'),
    [agendaItems, today]
  );
  const completedTasks = useMemo(
    () => agendaItems.filter((item) => ['task', 'reminder'].includes(item.type) && item.status === 'concluída').length,
    [agendaItems]
  );
  const lateTasks = useMemo(
    () => agendaItems.filter((item) => ['task', 'reminder'].includes(item.type) && statusForItem(item, today) === 'atrasada').length,
    [agendaItems, today]
  );
  const weddingDaysLeft = wedding?.wedding_date ? daysBetween(today, wedding.wedding_date) : null;
  const weddingStatus = wedding?.wedding_date
    ? weddingDaysLeft !== null && weddingDaysLeft > 0
      ? `Faltam ${weddingDaysLeft} dias para o casamento`
      : weddingDaysLeft === 0
        ? 'Hoje é o grande dia'
        : `Casamento em ${numericDateLabel(wedding.wedding_date)}`
    : 'Data do casamento ainda não definida';

  function openCreate(date = selectedDay ?? today, type: AgendaType = typeFilter !== 'all' ? typeFilter : 'task') {
    setSelectedDay(date);
    setEditingItem(null);
    setForm(formForDate(date, type));
    setError('');
    setModalOpen(true);
  }

  function openEdit(item: AgendaItem) {
    if (!['task', 'budget'].includes(item.source)) return;
    setEditingItem(item);
    setForm({
      title: item.title,
      type: item.type,
      date: item.date,
      time: item.time ?? '',
      location: item.location ?? '',
      category: item.type === 'payment' ? item.category || 'Outros' : item.type === 'event' ? 'Evento' : item.type === 'reminder' ? 'Lembrete' : item.category || 'Documentação',
      priority: item.priority ?? 'média',
      responsible: item.responsible ?? 'noiva',
      description: item.description ?? '',
      status: statusForItem(item, today),
      vendor_id: '',
      budget_item_id: '',
      amount: item.amount ?? 0
    });
    setError('');
    setModalOpen(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    setError('');
    try {
      if (form.type === 'payment') {
        const payload: Partial<BudgetItem> = {
          name: form.title.trim(),
          category: form.category || 'Outros',
          description: form.description || null,
          estimated_value: Number(form.amount ?? 0),
          contracted_value: Number(form.amount ?? 0),
          paid_value: form.status === 'pago' ? Number(form.amount ?? 0) : 0,
          payment_status: form.status,
          due_date: form.date,
          payment_date: form.status === 'pago' ? form.date : null,
          payment_method: null,
          vendor_id: form.vendor_id || null,
          receipt_url: null,
          notes: form.location ? `Local: ${form.location}` : null
        };
        if (editingItem?.source === 'budget') await budgetItems.update(editingItem.sourceId, payload);
        else await budgetItems.create(payload);
      } else {
        const category = form.type === 'event' ? 'Evento' : form.type === 'reminder' ? 'Lembrete' : form.category;
        const payload: Partial<Task> = {
          title: form.title.trim(),
          description: [form.description, form.location ? `Local: ${form.location}` : '', form.time ? `Horário: ${form.time}` : ''].filter(Boolean).join('\n') || null,
          category,
          responsible: form.responsible,
          due_date: form.date,
          priority: form.priority,
          status: form.status,
          vendor_id: form.vendor_id || null,
          budget_item_id: form.budget_item_id || null
        };
        if (editingItem?.source === 'task') await tasks.update(editingItem.sourceId, payload);
        else await tasks.create(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o item.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(item: AgendaItem) {
    const status = nextStatus(item.type, item.status);
    if (item.source === 'task') await tasks.update(item.sourceId, { status });
    if (item.source === 'budget') await budgetItems.update(item.sourceId, { payment_status: status, payment_date: status === 'pago' ? today : null });
  }

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDay(key: string) {
    setSelectedDay(key);
    setMonth(new Date(dateFromKey(key).getFullYear(), dateFromKey(key).getMonth(), 1));
    openCreate(key);
  }

  function goToToday() {
    const now = dateFromKey(today);
    setSelectedDay(today);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setView('calendar');
  }

  return (
    <div className="space-y-5 text-[#1F2937]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title text-[#1F2937]">Central de Planejamento do Casamento</h1>
          <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-[#E11D48]">
            <span aria-hidden="true">💍</span>
            {weddingStatus}
          </p>
          <p className="mt-1 text-sm text-[#71717A]">Eventos, tarefas, vencimentos, lembretes e compromissos em um só lugar.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex shrink-0 rounded-xl border border-[#F0EBE6] bg-white p-1 shadow-soft">
            <button type="button" onClick={() => setView('list')} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${view === 'list' ? 'bg-[#E11D48] text-white' : 'text-[#71717A]'}`}>
              <List size={16} /> Lista
            </button>
            <button type="button" onClick={() => setView('calendar')} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${view === 'calendar' ? 'bg-[#E11D48] text-white' : 'text-[#71717A]'}`}>
              <CalendarDays size={16} /> Calendário
            </button>
          </div>
          <button type="button" className="btn-secondary shrink-0" onClick={goToToday}>
            <CalendarDays size={17} /> Hoje
          </button>
          <button type="button" className="btn-primary shrink-0 bg-[#E11D48] hover:bg-[#BE123C]" onClick={() => openCreate(selectedDay ?? today)}>
            <Plus size={17} /> Novo item
          </button>
        </div>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Próximo compromisso"
          value={nextCommitment?.title ?? 'Nada agendado'}
          meta={nextCommitment ? numericDateLabel(nextCommitment.date) : 'Agenda livre'}
          icon={<CalendarClock size={17} />}
          tone="rose"
        />
        <SummaryCard
          title="Próximo vencimento"
          value={nextPayment?.title ?? 'Sem vencimentos'}
          meta={nextPayment ? `${numericDateLabel(nextPayment.date)}${nextPayment.amount ? ` · ${formatMoney(nextPayment.amount)}` : ''}` : 'Pagamentos em dia'}
          icon={<WalletCards size={17} />}
          tone="warning"
        />
        <SummaryCard
          title="Tarefas concluídas"
          value={String(completedTasks)}
          meta="Itens finalizados"
          icon={<CheckCircle2 size={17} />}
          tone="success"
        />
        <SummaryCard
          title="Tarefas atrasadas"
          value={String(lateTasks)}
          meta={lateTasks ? 'Precisam de atenção' : 'Tudo sob controle'}
          icon={<AlertTriangle size={17} />}
          tone={lateTasks ? 'danger' : 'success'}
        />
      </section>

      <div className="grid gap-3 rounded-lg border border-[#F0EBE6] bg-white p-3 shadow-[0_10px_24px_rgba(31,41,55,0.04)] lg:grid-cols-2">
        <FilterRow label="Período">
          {(Object.keys(periodLabels) as PeriodFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setPeriodFilter(filter)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${periodFilter === filter ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-rose' : 'border-[#F0EBE6] bg-[#FAFAFA] text-[#71717A] hover:border-[#E11D48]/40'}`}
            >
              {periodLabels[filter]} · {counts[filter]}
            </button>
          ))}
        </FilterRow>

        <FilterRow label="Tipo">
          {(['all', 'event', 'task', 'payment', 'reminder'] as TypeFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTypeFilter(filter)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${typeFilter === filter ? 'border-[#1F2937] bg-[#1F2937] text-white' : 'border-[#F0EBE6] bg-[#FAFAFA] text-[#71717A]'}`}
            >
              {filter !== 'all' && <span className={`h-2 w-2 rounded-full ${typeDotColor(filter)}`} />}
              {filter === 'all' ? 'Todos' : typeLabels[filter]} · {filter === 'all' ? counts.all : counts[filter]}
            </button>
          ))}
        </FilterRow>
      </div>

      {view === 'list' ? (
        <AgendaList groups={groups} items={visibleItems} today={today} onEdit={openEdit} onToggle={toggleDone} onCreate={() => openCreate(today)} />
      ) : (
        <CalendarPanel
          month={month}
          monthDays={monthDays}
          today={today}
          selectedDay={selectedDay}
          itemsByDate={itemsByDate}
          selectedItems={selectedItems}
          weddingDate={wedding?.wedding_date ?? null}
          weddingStatus={weddingStatus}
          nextCommitment={nextCommitment}
          nextPayment={nextPayment}
          lateTasks={lateTasks}
          onMoveMonth={moveMonth}
          onSelectDay={selectDay}
          onCreate={openCreate}
          onEdit={openEdit}
          onToggle={toggleDone}
        />
      )}

      <button
        type="button"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-20 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#E11D48] px-4 text-sm font-bold text-white shadow-rose transition hover:bg-[#BE123C] lg:bottom-6"
        onClick={() => openCreate(selectedDay ?? today)}
      >
        <Plus size={18} /> Novo
      </button>

      <Modal open={modalOpen} title={editingItem ? 'Editar item da agenda' : 'Novo item da agenda'} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveItem} className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['event', 'task', 'payment', 'reminder'] as AgendaType[]).map((type) => {
              const Icon = typeIcon(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, type, status: statusesByType[type][0], category: type === 'payment' ? 'Outros' : type === 'event' ? 'Evento' : type === 'reminder' ? 'Lembrete' : 'Documentação' })}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${form.type === type ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-rose' : 'border-[#F0EBE6] bg-[#FAFAFA] text-[#1F2937]'}`}
                >
                  <Icon size={16} /> + {typeLabels[type]}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput label="Título" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Ex: Confirmar fotógrafo" />
            </div>
            <FormSelect
              label="Tipo"
              value={form.type}
              onChange={(event) => {
                const type = event.target.value as AgendaType;
                setForm({ ...form, type, status: statusesByType[type][0], category: type === 'event' ? 'Evento' : type === 'reminder' ? 'Lembrete' : form.category });
              }}
              options={[
                { label: 'Tarefa', value: 'task' },
                { label: 'Evento', value: 'event' },
                { label: 'Vencimento', value: 'payment' },
                { label: 'Lembrete', value: 'reminder' }
              ]}
            />
            <FormInput label="Data" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            <FormInput label="Horário" type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            <FormInput label="Local" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Ex: salão, igreja, endereço" />
            <FormSelect
              label="Categoria"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={(form.type === 'payment' ? categoryOptions : [...taskCategories, 'Evento', 'Lembrete']).map((value) => ({ label: value, value }))}
            />
            <FormSelect label="Prioridade" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={priorities.map((value) => ({ label: value, value }))} />
            <FormSelect label="Responsável" value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} options={responsibleOptions.map((value) => ({ label: value, value }))} />
            <FormSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={statusesByType[form.type].map((value) => ({ label: value, value }))} />
            {form.type === 'payment' && (
              <>
                <FormInput label="Valor" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />
                <FormSelect label="Fornecedor" value={form.vendor_id} onChange={(event) => setForm({ ...form, vendor_id: event.target.value })} options={[{ label: 'Sem fornecedor', value: '' }, ...vendors.rows.map((vendor) => ({ label: vendor.name, value: vendor.id }))]} />
              </>
            )}
            {form.type !== 'payment' && (
              <>
                <FormSelect label="Fornecedor vinculado" value={form.vendor_id} onChange={(event) => setForm({ ...form, vendor_id: event.target.value })} options={[{ label: 'Sem fornecedor', value: '' }, ...vendors.rows.map((vendor) => ({ label: vendor.name, value: vendor.id }))]} />
                <FormSelect label="Item financeiro" value={form.budget_item_id} onChange={(event) => setForm({ ...form, budget_item_id: event.target.value })} options={[{ label: 'Sem vínculo', value: '' }, ...budgetItems.rows.map((item) => ({ label: item.name, value: item.id }))]} />
              </>
            )}
            <div className="sm:col-span-2">
              <FormTextarea label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalhes importantes para lembrar depois" />
            </div>
          </div>
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-[#F0EBE6] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:static sm:mx-0 sm:border-0 sm:p-0">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary bg-[#E11D48] hover:bg-[#BE123C]" disabled={saving}>{saving ? 'Salvando...' : editingItem ? 'Salvar item' : 'Criar item'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ title, value, meta, icon, tone }: { title: string; value: string; meta: string; icon: ReactNode; tone: 'rose' | 'warning' | 'success' | 'danger' }) {
  const styles = {
    rose: 'bg-rose-50 text-[#E11D48]',
    warning: 'bg-amber-50 text-[#F59E0B]',
    success: 'bg-green-50 text-[#22C55E]',
    danger: 'bg-red-50 text-[#EF4444]'
  }[tone];
  return (
    <article className="rounded-lg border border-[#F0EBE6] bg-white p-3 shadow-[0_10px_24px_rgba(31,41,55,0.045)]">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#71717A]">{title}</p>
          <p className="mt-1 truncate text-sm font-bold text-[#1F2937]">{value}</p>
          <p className="mt-0.5 truncate text-xs text-[#71717A]">{meta}</p>
        </div>
      </div>
    </article>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">{label}</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">{children}</div>
    </section>
  );
}

function AgendaList({
  groups,
  items,
  today,
  onEdit,
  onToggle,
  onCreate
}: {
  groups: { label: string; items: AgendaItem[]; accent: string }[] | null;
  items: AgendaItem[];
  today: string;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onCreate: () => void;
}) {
  if (!items.length) return <EmptyAgenda onCreate={onCreate} />;
  if (groups?.length) {
    return (
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className={`text-xs font-bold uppercase tracking-widest ${group.accent}`}>{group.label}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#71717A] ring-1 ring-[#F0EBE6]">{group.items.length}</span>
              <div className="h-px flex-1 bg-[#F0EBE6]" />
            </div>
            <div className="grid gap-2">
              {group.items.map((item) => <AgendaCard key={item.id} item={item} today={today} onEdit={onEdit} onToggle={onToggle} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }
  return <div className="grid gap-2">{items.map((item) => <AgendaCard key={item.id} item={item} today={today} onEdit={onEdit} onToggle={onToggle} />)}</div>;
}

function AgendaCard({ item, today, onEdit, onToggle }: { item: AgendaItem; today: string; onEdit: (item: AgendaItem) => void; onToggle: (item: AgendaItem) => void }) {
  const Icon = typeIcon(item.type);
  const currentStatus = statusForItem(item, today);
  const actionable = item.source === 'task' || item.source === 'budget';
  return (
    <article className="grid gap-3 rounded-lg border border-[#F0EBE6] bg-white p-3 shadow-[0_10px_24px_rgba(31,41,55,0.045)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${typeTone(item.type)}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${typeTone(item.type)}`}>{typeLabels[item.type]}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${['atrasada', 'vencido'].includes(currentStatus) ? 'bg-red-50 text-red-700' : currentStatus === 'concluída' || currentStatus === 'pago' || currentStatus === 'realizado' ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>{currentStatus}</span>
          {item.priority && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{item.priority}</span>}
        </div>
        <h3 className="mt-1 truncate text-sm font-bold text-[#1F2937]">{item.title}</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#71717A]">
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {compactDateLabel(item.date)}{item.time ? ` · ${item.time}` : ''}</span>
          {item.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {item.location}</span>}
          {item.responsible && <span className="inline-flex items-center gap-1"><User size={13} /> {item.responsible}</span>}
          {item.amount !== undefined && <span className="inline-flex items-center gap-1"><Receipt size={13} /> {formatMoney(item.amount)}</span>}
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-[#71717A]">{item.description}</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {actionable && (
          <>
            <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => onToggle(item)}><CheckCircle2 size={15} /> {item.type === 'payment' ? 'Pagar' : 'Concluir'}</button>
            <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => onEdit(item)}>Editar</button>
          </>
        )}
        <Link className="btn-secondary min-h-9 px-3 text-xs" to={item.href}>Abrir <ExternalLink size={14} /></Link>
      </div>
    </article>
  );
}

function CalendarPanel({
  month,
  monthDays,
  today,
  selectedDay,
  itemsByDate,
  selectedItems,
  weddingDate,
  weddingStatus,
  nextCommitment,
  nextPayment,
  lateTasks,
  onMoveMonth,
  onSelectDay,
  onCreate,
  onEdit,
  onToggle
}: {
  month: Date;
  monthDays: Date[];
  today: string;
  selectedDay: string | null;
  itemsByDate: Record<string, AgendaItem[]>;
  selectedItems: AgendaItem[];
  weddingDate: string | null;
  weddingStatus: string;
  nextCommitment?: AgendaItem;
  nextPayment?: AgendaItem;
  lateTasks: number;
  onMoveMonth: (offset: number) => void;
  onSelectDay: (key: string) => void;
  onCreate: (date: string, type?: AgendaType) => void;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-lg border border-[#F0EBE6] bg-white shadow-[0_16px_36px_rgba(31,41,55,0.06)]">
        <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE6] px-3 py-3">
          <button type="button" className="btn-secondary min-h-9 px-3" onClick={() => onMoveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <h2 className="min-w-0 truncate text-center text-sm font-bold capitalize text-[#1F2937]">{monthLabel(month)}</h2>
          <button type="button" className="btn-secondary min-h-9 px-3" onClick={() => onMoveMonth(1)} aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#F0EBE6] bg-[#FAFAFA] text-center text-[10px] font-bold uppercase tracking-wide text-[#71717A]">
          {weekdays.map((weekday) => <span key={weekday} className="py-2">{weekday}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const key = dateKey(day);
            const dayItems = itemsByDate[key] ?? [];
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isToday = key === today;
            const isSelected = key === selectedDay;
            const types = Array.from(new Set(dayItems.map((item) => item.type)));
            const tooltip = dayItems.map((item) => `${typeLabels[item.type]}: ${item.title}`).join('\n');
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(key)}
                title={tooltip || 'Clique para criar um item'}
                className={`relative min-h-[68px] border-b border-r border-[#F0EBE6] p-1.5 text-left transition sm:min-h-[104px] ${isSelected ? 'bg-rose-50 ring-2 ring-inset ring-[#E11D48]/35' : 'hover:bg-[#FAFAFA]'} ${isCurrentMonth ? 'text-[#1F2937]' : 'bg-[#FAFAFA] text-[#A1A1AA]'}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-[#E11D48] text-white' : isSelected ? 'bg-white text-[#E11D48]' : ''}`}>{day.getDate()}</span>
                {!!types.length && <div className="mt-1 flex flex-wrap gap-1">{types.map((type) => <span key={type} className={`h-2 w-2 rounded-full ${typeDotColor(type)}`} />)}</div>}
                <div className="mt-1 hidden space-y-1 sm:block">
                  {dayItems.slice(0, 3).map((item) => <div key={item.id} className={`truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold ${typeTone(item.type)}`}>● {typeLabels[item.type]}</div>)}
                  {dayItems.length > 3 && <p className="px-1 text-[10px] font-semibold text-[#71717A]">+{dayItems.length - 3} itens</p>}
                </div>
                <button
                  type="button"
                  className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded-full bg-[#E11D48] text-white shadow-rose sm:group-hover:flex"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreate(key);
                  }}
                  aria-label="Novo item neste dia"
                >
                  <Plus size={14} />
                </button>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="hidden rounded-lg border border-[#F0EBE6] bg-white p-4 shadow-[0_16px_36px_rgba(31,41,55,0.06)] xl:block">
        {selectedDay ? (
          <DayItemsPanel selectedDay={selectedDay} items={selectedItems} today={today} onCreate={onCreate} onEdit={onEdit} onToggle={onToggle} />
        ) : (
          <CalendarSummaryPanel weddingDate={weddingDate} weddingStatus={weddingStatus} nextCommitment={nextCommitment} nextPayment={nextPayment} lateTasks={lateTasks} />
        )}
      </aside>

      <section className="rounded-lg border border-[#F0EBE6] bg-white p-4 shadow-[0_-8px_26px_rgba(31,41,55,0.06)] xl:hidden">
        {selectedDay ? (
          <DayItemsPanel selectedDay={selectedDay} items={selectedItems} today={today} onCreate={onCreate} onEdit={onEdit} onToggle={onToggle} />
        ) : (
          <CalendarSummaryPanel weddingDate={weddingDate} weddingStatus={weddingStatus} nextCommitment={nextCommitment} nextPayment={nextPayment} lateTasks={lateTasks} />
        )}
      </section>
    </div>
  );
}

function DayItemsPanel({ selectedDay, items, today, onCreate, onEdit, onToggle }: { selectedDay: string; items: AgendaItem[]; today: string; onCreate: (date: string, type?: AgendaType) => void; onEdit: (item: AgendaItem) => void; onToggle: (item: AgendaItem) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1F2937]">Compromissos de {longDateLabel(selectedDay)}</h2>
          <p className="mt-1 text-xs text-[#71717A]">{items.length ? `${items.length} item(ns) neste dia` : 'Nenhum item neste dia'}</p>
        </div>
        <button type="button" className="btn-primary min-h-9 shrink-0 bg-[#E11D48] px-3 text-xs hover:bg-[#BE123C]" onClick={() => onCreate(selectedDay)}><Plus size={15} /> Novo</button>
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <AgendaCard key={item.id} item={item} today={today} onEdit={onEdit} onToggle={onToggle} />
        )) : (
          <div className="rounded-lg border border-dashed border-[#F0EBE6] bg-[#FAFAFA] px-4 py-8 text-center">
            <Clock3 className="mx-auto text-[#A1A1AA]" size={28} />
            <p className="mt-2 text-sm font-semibold text-[#1F2937]">Dia livre</p>
            <p className="mt-1 text-xs text-[#71717A]">Use o botão acima para criar tarefa, evento, vencimento ou lembrete.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarSummaryPanel({
  weddingDate,
  weddingStatus,
  nextCommitment,
  nextPayment,
  lateTasks
}: {
  weddingDate: string | null;
  weddingStatus: string;
  nextCommitment?: AgendaItem;
  nextPayment?: AgendaItem;
  lateTasks: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[#1F2937]">Resumo</h2>
        <p className="mt-1 text-xs text-[#71717A]">Central operacional do casamento</p>
      </div>
      <div className="rounded-lg border border-rose-100 bg-rose-50/70 p-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#E11D48]">
            <Heart size={17} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#E11D48]">Casamento</p>
            <p className="mt-1 text-sm font-bold text-[#1F2937]">{weddingDate ? numericDateLabel(weddingDate) : 'Sem data definida'}</p>
            <p className="mt-0.5 text-xs text-[#71717A]">{weddingStatus}</p>
          </div>
        </div>
      </div>
      <PanelSummaryLine icon={<CalendarClock size={15} />} label="Próximo compromisso" value={nextCommitment?.title ?? 'Nada agendado'} meta={nextCommitment ? numericDateLabel(nextCommitment.date) : 'Sem próximos compromissos'} />
      <PanelSummaryLine icon={<WalletCards size={15} />} label="Próximo vencimento" value={nextPayment?.title ?? 'Sem vencimentos'} meta={nextPayment ? numericDateLabel(nextPayment.date) : 'Pagamentos em dia'} />
      <PanelSummaryLine icon={<AlertTriangle size={15} />} label="Tarefas atrasadas" value={String(lateTasks)} meta={lateTasks ? 'Itens precisam de atenção' : 'Nenhuma tarefa atrasada'} danger={lateTasks > 0} />
    </div>
  );
}

function PanelSummaryLine({ icon, label, value, meta, danger = false }: { icon: ReactNode; label: string; value: string; meta: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-[#F0EBE6] bg-[#FAFAFA] p-3">
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-red-50 text-[#EF4444]' : 'bg-white text-[#E11D48]'}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#71717A]">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-[#1F2937]">{value}</p>
          <p className="mt-0.5 truncate text-xs text-[#71717A]">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyAgenda({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[#F0EBE6] bg-white px-4 py-12 text-center">
      <CalendarDays className="mx-auto text-[#E11D48]" size={36} />
      <h3 className="mt-3 text-base font-bold text-[#1F2937]">Nenhum item encontrado</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#71717A]">Crie tarefas, eventos, vencimentos ou lembretes diretamente na Agenda.</p>
      <button type="button" className="btn-primary mt-4 bg-[#E11D48] hover:bg-[#BE123C]" onClick={onCreate}><Plus size={16} /> Criar item</button>
    </div>
  );
}
