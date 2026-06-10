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
  MoreHorizontal,
  Plus,
  Receipt,
  Trash2,
  User,
  WalletCards
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
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
type TypeFilter = 'all' | 'event' | 'task' | 'payment';
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
const typeEmoji: Record<AgendaType, string> = {
  task: '✅',
  event: '📅',
  payment: '💰',
  reminder: '🔔'
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

function shortDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateFromKey(value));
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

function statusTone(status: string) {
  if (['pago', 'concluida', 'concluÃ­da', 'realizado'].includes(status)) return 'bg-green-50 text-green-700 ring-green-100';
  if (['vencido', 'atrasada'].includes(status)) return 'bg-red-50 text-red-700 ring-red-100';
  if (['pendente', 'em andamento', 'agendado'].includes(status)) return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-slate-50 text-slate-600 ring-slate-100';
}

function paymentPriorityTone(item: AgendaItem, today: string) {
  const currentStatus = statusForItem(item, today);
  if (currentStatus === 'pago') return 'bg-green-500';
  if (currentStatus === 'vencido') return 'bg-red-500';
  if (daysBetween(today, item.date) <= 7) return 'bg-amber-500';
  return 'bg-sky-400';
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
  const [openMenuId, setOpenMenuId] = useState('');

  useEffect(() => {
    function closeMenu() {
      setOpenMenuId('');
    }

    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

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
      if (typeFilter === 'all') return true;
      if (typeFilter === 'event') return item.type === 'event';
      if (typeFilter === 'task') return item.type === 'task' || item.type === 'reminder';
      if (typeFilter === 'payment') return item.type === 'payment';
      return true;
    });
  }, [agendaItems, typeFilter]);

  const counts = useMemo(() => ({
    all: agendaItems.length,
    event: agendaItems.filter((item) => item.type === 'event').length,
    task: agendaItems.filter((item) => item.type === 'task' || item.type === 'reminder').length,
    payment: agendaItems.filter((item) => item.type === 'payment').length,
  }), [agendaItems]);

  const groups = useMemo(() => {
    return [
      { label: 'Hoje', items: visibleItems.filter((item) => item.date === today), accent: 'text-[#E11D48]' },
      { label: 'Próximos 7 dias', items: visibleItems.filter((item) => item.date > today && item.date <= in7Days), accent: 'text-[#F59E0B]' },
      { label: 'Próximos 30 dias', items: visibleItems.filter((item) => item.date > in7Days && item.date <= in30Days), accent: 'text-[#1F2937]' },
      { label: 'Atrasados', items: visibleItems.filter((item) => ['atrasada', 'vencido'].includes(statusForItem(item, today))), accent: 'text-[#EF4444]' },
      { label: 'Futuro', items: visibleItems.filter((item) => item.date > in30Days), accent: 'text-[#71717A]' }
    ].filter((group) => group.items.length);
  }, [in30Days, in7Days, today, visibleItems]);

  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const calendarItems = useMemo(() => visibleItems.filter((item) => sameMonth(item.date, month)), [month, visibleItems]);
  const itemsByDate = useMemo(() => calendarItems.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    acc[item.date] = [...(acc[item.date] ?? []), item];
    return acc;
  }, {}), [calendarItems]);
  const selectedItems = selectedDay ? (itemsByDate[selectedDay] ?? []) : [];


  const weddingDaysLeft = wedding?.wedding_date ? daysBetween(today, wedding.wedding_date) : null;
  const weddingCountdown = wedding?.wedding_date
    ? weddingDaysLeft !== null && weddingDaysLeft > 0
      ? `💍 Faltam ${weddingDaysLeft} dias`
      : weddingDaysLeft === 0
        ? '💍 Hoje é o grande dia!'
        : `💍 Casamento em ${numericDateLabel(wedding.wedding_date)}`
    : null;

  function openCreate(date = selectedDay ?? today, type: AgendaType = typeFilter !== 'all' ? (typeFilter === 'task' ? 'task' : typeFilter === 'event' ? 'event' : 'payment') : 'task') {
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
    setOpenMenuId('');
    const status = nextStatus(item.type, item.status);
    if (item.source === 'task') await tasks.update(item.sourceId, { status });
    if (item.source === 'budget') await budgetItems.update(item.sourceId, { payment_status: status, payment_date: status === 'pago' ? today : null });
  }

  async function removeItem(item: AgendaItem) {
    setOpenMenuId('');
    if (!['task', 'budget'].includes(item.source)) return;
    const confirmed = window.confirm(`Excluir "${item.title}" da agenda?`);
    if (!confirmed) return;
    if (item.source === 'task') await tasks.remove(item.sourceId);
    if (item.source === 'budget') await budgetItems.remove(item.sourceId);
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

  const filterTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: `Todos${counts.all ? ` · ${counts.all}` : ''}` },
    { key: 'event', label: `Eventos${counts.event ? ` · ${counts.event}` : ''}` },
    { key: 'task', label: `Tarefas${counts.task ? ` · ${counts.task}` : ''}` },
    { key: 'payment', label: `Vencimentos${counts.payment ? ` · ${counts.payment}` : ''}` },
  ];

  return (
    <div className="space-y-3 pb-28 text-[#1F2937] sm:space-y-4 md:pb-0" onClick={() => setOpenMenuId('')}>
      {/* Header */}
      <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between md:pt-0">
        <div className="min-w-0">
          <h1 className="page-title text-[#1F2937]">Central de Planejamento</h1>
          {weddingCountdown && (
            <p className="mt-1 inline-flex rounded-full border border-[#FCE4EA] bg-[#FFF1F5] px-2.5 py-1 text-xs font-bold text-[#E11D48]">{weddingCountdown}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="grid w-full grid-cols-2 rounded-2xl border border-[#F0EBE6] bg-white p-1 shadow-soft sm:w-auto">
            <button type="button" onClick={() => setView('list')} className={`inline-flex min-h-8 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition sm:min-h-9 sm:text-sm ${view === 'list' ? 'bg-[#E11D48] text-white shadow-rose' : 'bg-white text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#1F2937]'}`}>
              <List size={16} /> Lista
            </button>
            <button type="button" onClick={() => setView('calendar')} className={`inline-flex min-h-8 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition sm:min-h-9 sm:text-sm ${view === 'calendar' ? 'bg-[#E11D48] text-white shadow-rose' : 'bg-white text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#1F2937]'}`}>
              <CalendarDays size={16} /> Calendário
            </button>
          </div>
          <button
            type="button"
            className="hidden min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#E11D48] px-3.5 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#BE123C] hover:shadow-rose md:inline-flex"
            onClick={() => openCreate(selectedDay ?? today)}
          >
            <Plus size={16} /> Novo
          </button>
        </div>
      </div>

      {/* Next Action Card */}
      {/* Filter Tabs — single row */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 py-0.5 sm:mx-0 sm:rounded-2xl sm:border sm:border-[#F0EBE6] sm:bg-white/80 sm:p-1.5 sm:shadow-soft">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTypeFilter(tab.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold shadow-soft ring-1 transition sm:rounded-xl sm:text-sm ${
              typeFilter === tab.key
                ? 'bg-[#E11D48] text-white ring-[#E11D48]'
                : 'bg-white text-[#71717A] ring-[#F0EBE6] hover:bg-[#F9F5F3] hover:text-[#1F2937]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'list' ? (
        <AgendaList
          groups={groups}
          items={visibleItems}
          today={today}
          openMenuId={openMenuId}
          onMenuToggle={setOpenMenuId}
          onEdit={openEdit}
          onToggle={toggleDone}
          onDelete={removeItem}
          onCreate={() => openCreate(today)}
        />
      ) : (
        <CalendarPanel
          month={month}
          monthDays={monthDays}
          today={today}
          selectedDay={selectedDay}
          itemsByDate={itemsByDate}
          selectedItems={selectedItems}
          weddingDate={wedding?.wedding_date ?? null}
          weddingCountdown={weddingCountdown}
          onMoveMonth={moveMonth}
          onToday={goToToday}
          onSelectDay={selectDay}
          onCreate={openCreate}
          onEdit={openEdit}
          onToggle={toggleDone}
          onDelete={removeItem}
          openMenuId={openMenuId}
          onMenuToggle={setOpenMenuId}
        />
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        id="agenda-fab-novo"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#E11D48] text-white shadow-rose transition hover:bg-[#BE123C] md:hidden"
        onClick={() => openCreate(selectedDay ?? today)}
        aria-label="Novo item"
      >
        <Plus size={20} />
      </button>

      {/* Modal */}
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
                  <Icon size={16} /> {typeLabels[type]}
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

function AgendaList({
  groups,
  items,
  today,
  openMenuId,
  onMenuToggle,
  onEdit,
  onToggle,
  onDelete,
  onCreate
}: {
  groups: { label: string; items: AgendaItem[]; accent: string }[];
  items: AgendaItem[];
  today: string;
  openMenuId: string;
  onMenuToggle: (id: string) => void;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onDelete: (item: AgendaItem) => void;
  onCreate: () => void;
}) {
  if (!items.length) return <EmptyAgenda onCreate={onCreate} />;

  return (
    <div className="space-y-4 sm:space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-2.5 flex items-center gap-2">
            <h2 className={`text-[11px] font-extrabold uppercase tracking-widest ${group.accent}`}>{group.label}</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-[#71717A] ring-1 ring-[#F0EBE6]">{group.items.length}</span>
            <div className="h-px flex-1 bg-[#F0EBE6]/80" />
          </div>
          <div className="space-y-2">
            {group.items.map((item) => (
              <AgendaCard
                key={item.id}
                item={item}
                today={today}
                menuOpen={openMenuId === item.id}
                onMenuToggle={onMenuToggle}
                onEdit={onEdit}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Agenda Card ─── */
function AgendaCard({
  item,
  today,
  menuOpen,
  onMenuToggle,
  onEdit,
  onToggle,
  onDelete
}: {
  item: AgendaItem;
  today: string;
  menuOpen: boolean;
  onMenuToggle: (id: string) => void;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onDelete: (item: AgendaItem) => void;
}) {
  const currentStatus = statusForItem(item, today);
  const actionable = item.source === 'task' || item.source === 'budget';
  const isDone = ['concluida', 'concluÃ­da', 'pago', 'realizado'].includes(currentStatus);
  const isOverdue = ['atrasada', 'vencido'].includes(currentStatus);
  const Icon = typeIcon(item.type);
  const isPayment = item.type === 'payment';
  const actionLabel = item.type === 'payment' ? (isDone ? 'Marcar como pendente' : 'Marcar como pago') : isDone ? 'Reabrir item' : item.type === 'event' ? 'Marcar como realizado' : 'Marcar como concluido';

  return (
    <article
      className={`relative flex gap-3 rounded-2xl border p-3 shadow-soft transition sm:p-3.5 ${isOverdue ? 'border-red-200 bg-red-50/40' : isDone ? 'border-[#F0EBE6] bg-[#FAFAFA]' : 'border-[#F0EBE6] bg-white hover:-translate-y-0.5 hover:border-[#E11D48]/25 hover:shadow-card'}`}
      onClick={(event) => event.stopPropagation()}
    >
      {isPayment && <span className={`absolute left-0 top-4 h-10 w-1 rounded-r-full ${paymentPriorityTone(item, today)}`} />}

      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${typeTone(item.type)}`}>
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1 pr-8">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-extrabold leading-5 sm:text-[15px] ${isDone ? 'text-[#A1A1AA] line-through' : 'text-[#1F2937]'}`}>{item.title}</p>
            {isPayment && item.location && <p className="mt-0.5 truncate text-xs font-semibold text-[#71717A]">{item.location}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1 ${isOverdue ? 'bg-red-100 text-red-700 ring-red-100' : 'bg-[#FAFAFA] text-[#71717A] ring-[#F0EBE6]'}`}>{isOverdue ? 'Atrasado' : typeLabels[item.type]}</span>
        </div>

        <div className="mt-2 grid gap-1 text-xs font-semibold text-[#71717A] sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
          <span className="inline-flex min-w-0 items-center gap-1">
            <CalendarDays size={12} className="shrink-0" />
            <span className="truncate">{isPayment ? 'Data' : item.type === 'task' || item.type === 'reminder' ? 'Prazo' : 'Data'}: {shortDateLabel(item.date)}</span>
          </span>
          {item.time && <span className="inline-flex min-w-0 items-center gap-1"><Clock3 size={12} className="shrink-0" /><span className="truncate">{item.time}</span></span>}
          {!isPayment && item.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={12} className="shrink-0" /><span className="truncate">{item.location}</span></span>}
          {item.amount !== undefined && <span className="inline-flex min-w-0 items-center gap-1"><Receipt size={12} className="shrink-0" /><span className="truncate">{formatMoney(item.amount)}</span></span>}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusTone(currentStatus)}`}>{currentStatus}</span>
          {item.priority && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#71717A] ring-1 ring-[#F0EBE6]">{item.priority}</span>}
        </div>
      </div>

      <div className="absolute right-2 top-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-[#71717A] transition hover:bg-[#FAFAFA] hover:text-[#1F2937]"
          onClick={(event) => {
            event.stopPropagation();
            onMenuToggle(menuOpen ? '' : item.id);
          }}
          aria-label="Acoes do item"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={18} />
        </button>

        {menuOpen && (
          <div className="absolute bottom-10 right-0 z-50 w-56 overflow-hidden rounded-2xl border border-[#F0EBE6] bg-white shadow-float animate-scale-in md:bottom-auto md:top-10" onClick={(event) => event.stopPropagation()}>
            <Link to={item.href} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#1F2937] hover:bg-[#FAFAFA]">
              <ExternalLink size={15} /> Ver detalhes
            </Link>
            {actionable && <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#1F2937] hover:bg-[#FAFAFA]" onClick={() => onEdit(item)}><CalendarClock size={15} /> Editar</button>}
            {actionable && <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#1F2937] hover:bg-[#FAFAFA]" onClick={() => onToggle(item)}><CheckCircle2 size={15} /> {actionLabel}</button>}
            {actionable && <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => onDelete(item)}><Trash2 size={15} /> Excluir</button>}
          </div>
        )}
      </div>
    </article>
  );
}

function AgendaCardLegacy({ item, today, onEdit, onToggle }: { item: AgendaItem; today: string; onEdit: (item: AgendaItem) => void; onToggle: (item: AgendaItem) => void }) {
  const currentStatus = statusForItem(item, today);
  const actionable = item.source === 'task' || item.source === 'budget';
  const isDone = ['concluida', 'concluída', 'pago', 'realizado'].includes(currentStatus);
  const isOverdue = ['atrasada', 'vencido'].includes(currentStatus);
  const Icon = typeIcon(item.type);

  return (
    <article
      className={`group flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-soft transition ${isOverdue ? 'border-red-200 bg-red-50/40' : isDone ? 'border-[#F0EBE6] bg-[#FAFAFA] opacity-80' : 'border-[#F0EBE6] bg-white hover:-translate-y-0.5 hover:border-[#E11D48]/25 hover:shadow-card'}`}
      onClick={() => (actionable ? onEdit(item) : undefined)}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${typeTone(item.type)}`}>
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`truncate text-sm font-extrabold leading-snug ${isDone ? 'text-[#A1A1AA] line-through' : 'text-[#1F2937]'}`}>{item.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-[#FAFAFA] text-[#71717A]'}`}>{isOverdue ? 'Atrasado' : typeLabels[item.type]}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#71717A]">
          <span>{shortDateLabel(item.date)}</span>
          {item.time && <span>{item.time}</span>}
          {item.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {item.location}</span>}
          {item.amount !== undefined && <span>{formatMoney(item.amount)}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
        {actionable && (
          <button
            type="button"
            title={item.type === 'payment' ? 'Marcar como pago' : 'Marcar como concluido'}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(item);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${isDone ? 'border-green-200 bg-green-50 text-green-600' : 'border-[#F0EBE6] bg-white text-[#71717A] hover:border-green-300 hover:bg-green-50 hover:text-green-600'}`}
          >
            <CheckCircle2 size={16} />
          </button>
        )}
        {actionable && (
          <button
            type="button"
            title="Editar"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(item);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0EBE6] bg-white text-[#71717A] transition hover:border-[#E11D48]/40 hover:text-[#E11D48]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
        <Link
          to={item.href}
          title="Abrir"
          onClick={(event) => event.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0EBE6] bg-white text-[#71717A] transition hover:border-[#E11D48]/40 hover:text-[#E11D48]"
        >
          <ExternalLink size={14} />
        </Link>
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
  weddingCountdown,
  onMoveMonth,
  onToday,
  onSelectDay,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
  openMenuId,
  onMenuToggle
}: {
  month: Date;
  monthDays: Date[];
  today: string;
  selectedDay: string | null;
  itemsByDate: Record<string, AgendaItem[]>;
  selectedItems: AgendaItem[];
  weddingDate: string | null;
  weddingCountdown: string | null;
  onMoveMonth: (offset: number) => void;
  onToday: () => void;
  onSelectDay: (key: string) => void;
  onCreate: (date: string, type?: AgendaType) => void;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onDelete: (item: AgendaItem) => void;
  openMenuId: string;
  onMenuToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-[#F0EBE6] bg-white shadow-[0_16px_36px_rgba(31,41,55,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE6] px-3 py-3">
          <button type="button" className="btn-secondary min-h-9 px-3" onClick={() => onMoveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <div className="flex min-w-0 items-center justify-center gap-2">
            <h2 className="min-w-0 truncate text-center text-sm font-bold capitalize text-[#1F2937]">{monthLabel(month)}</h2>
            <button type="button" className="btn-secondary min-h-8 px-2.5 text-xs" onClick={onToday}>Hoje</button>
          </div>
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
                className={`relative min-h-[68px] border-b border-r border-[#F0EBE6] p-1.5 text-left transition sm:min-h-[96px] ${isSelected ? 'bg-rose-50 ring-2 ring-inset ring-[#E11D48]/35' : 'hover:bg-[#FAFAFA]'} ${isCurrentMonth ? 'text-[#1F2937]' : 'bg-[#FAFAFA] text-[#A1A1AA]'}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-[#E11D48] text-white' : isSelected ? 'bg-white text-[#E11D48]' : ''}`}>{day.getDate()}</span>
                {!!types.length && <div className="mt-1 flex flex-wrap gap-1">{types.map((type) => <span key={type} className={`h-2 w-2 rounded-full ${typeDotColor(type)}`} />)}</div>}
                <div className="mt-1 hidden space-y-1 sm:block">
                  {dayItems.slice(0, 2).map((item) => <div key={item.id} className={`truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold ${typeTone(item.type)}`}>{typeEmoji[item.type]} {item.title}</div>)}
                  {dayItems.length > 2 && <p className="px-1 text-[10px] font-semibold text-[#71717A]">+{dayItems.length - 2} mais</p>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="hidden rounded-xl border border-[#F0EBE6] bg-white p-4 shadow-[0_16px_36px_rgba(31,41,55,0.06)] xl:block">
        {selectedDay ? (
          <DayItemsPanel selectedDay={selectedDay} items={selectedItems} today={today} openMenuId={openMenuId} onMenuToggle={onMenuToggle} onCreate={onCreate} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
        ) : (
          <CalendarSidePanel weddingDate={weddingDate} weddingCountdown={weddingCountdown} />
        )}
      </aside>

      <section className="rounded-xl border border-[#F0EBE6] bg-white p-4 shadow-[0_-8px_26px_rgba(31,41,55,0.06)] xl:hidden">
        {selectedDay ? (
          <DayItemsPanel selectedDay={selectedDay} items={selectedItems} today={today} openMenuId={openMenuId} onMenuToggle={onMenuToggle} onCreate={onCreate} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
        ) : (
          <CalendarSidePanel weddingDate={weddingDate} weddingCountdown={weddingCountdown} />
        )}
      </section>
    </div>
  );
}

/* ─── Day Items Panel ─── */
function DayItemsPanel({
  selectedDay,
  items,
  today,
  openMenuId,
  onMenuToggle,
  onCreate,
  onEdit,
  onToggle,
  onDelete
}: {
  selectedDay: string;
  items: AgendaItem[];
  today: string;
  openMenuId: string;
  onMenuToggle: (id: string) => void;
  onCreate: (date: string, type?: AgendaType) => void;
  onEdit: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onDelete: (item: AgendaItem) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1F2937]">{longDateLabel(selectedDay)}</h2>
          <p className="mt-1 text-xs text-[#71717A]">{items.length ? `${items.length} item(ns)` : 'Dia livre'}</p>
        </div>
        <button type="button" className="btn-primary min-h-9 shrink-0 bg-[#E11D48] px-3 text-xs hover:bg-[#BE123C]" onClick={() => onCreate(selectedDay)}><Plus size={15} /> Novo</button>
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <AgendaCard
            key={item.id}
            item={item}
            today={today}
            menuOpen={openMenuId === item.id}
            onMenuToggle={onMenuToggle}
            onEdit={onEdit}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        )) : (
          <div className="rounded-xl border border-dashed border-[#F0EBE6] bg-[#FAFAFA] px-4 py-8 text-center">
            <Clock3 className="mx-auto text-[#A1A1AA]" size={28} />
            <p className="mt-2 text-sm font-semibold text-[#1F2937]">Dia livre</p>
            <p className="mt-1 text-xs text-[#71717A]">Clique em "Novo" para criar um item neste dia.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Calendar Side Panel ─── */
function CalendarSidePanel({
  weddingDate,
  weddingCountdown
}: {
  weddingDate: string | null;
  weddingCountdown: string | null;
}) {
  return (
    <div className="space-y-4">
      {weddingDate && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#E11D48] shadow-sm">
              <Heart size={18} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#E11D48]">Casamento</p>
              <p className="mt-0.5 text-sm font-bold text-[#1F2937]">{numericDateLabel(weddingDate)}</p>
              {weddingCountdown && <p className="mt-0.5 text-xs font-semibold text-[#E11D48]">{weddingCountdown}</p>}
            </div>
          </div>
        </div>
      )}

      <p className="rounded-xl border border-dashed border-[#F0EBE6] bg-[#FAFAFA] p-3 text-center text-xs text-[#A1A1AA]">Clique em um dia para ver ou criar itens</p>
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyAgenda({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#F0EBE6] bg-white px-4 py-12 text-center shadow-soft sm:py-16">
      <CalendarDays className="mx-auto text-[#E11D48]" size={36} />
      <h3 className="mt-3 text-base font-bold text-[#1F2937]">Nenhum item na agenda</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#71717A]">Adicione eventos, tarefas ou vencimentos para organizar o planejamento.</p>
      <button type="button" className="btn-primary mt-5 bg-[#E11D48] hover:bg-[#BE123C]" onClick={onCreate}><Plus size={16} /> Adicionar primeiro item</button>
    </div>
  );
}
