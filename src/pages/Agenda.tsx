import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Handshake,
  List,
  ListTodo,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Task, Vendor } from '../types';
import { formatMoney } from '../utils/format';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

type TimelineItem = {
  id: string;
  wedding_id: string;
  time: string;
  activity: string;
  responsible: string | null;
  place: string | null;
  notes: string | null;
};

type AgendaType = 'task' | 'payment' | 'vendor' | 'event';
type ViewMode = 'list' | 'calendar';
type FilterMode = 'all' | 'today' | 'week' | 'payments' | 'overdue';

type AgendaItem = {
  id: string;
  date: string;
  time?: string | null;
  type: AgendaType;
  title: string;
  description?: string;
  href: string;
  location?: string | null;
};

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const typeLabels: Record<AgendaType, string> = {
  task: 'Tarefa',
  payment: 'Vencimento',
  vendor: 'Fornecedor',
  event: 'Evento',
};

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

function formatDayLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(dateFromKey(value));
}

function sameMonth(value: string, month: Date): boolean {
  const d = dateFromKey(value);
  return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildMonthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ─────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────

function typeBadgeClasses(type: AgendaType): string {
  return {
    task: 'bg-amber-50 text-amber-700 ring-amber-200',
    payment: 'bg-rose-50 text-rose-700 ring-rose-200',
    vendor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    event: 'bg-pink-50 text-pink-700 ring-pink-200',
  }[type];
}

function typeCardBg(type: AgendaType): string {
  return {
    task: 'bg-amber-50/50 border-amber-100',
    payment: 'bg-rose-50/50 border-rose-100',
    vendor: 'bg-emerald-50/50 border-emerald-100',
    event: 'bg-pink-50/50 border-pink-100',
  }[type];
}

function typeDotColor(type: AgendaType): string {
  return {
    task: 'bg-amber-400',
    payment: 'bg-rose-400',
    vendor: 'bg-emerald-400',
    event: 'bg-pink-400',
  }[type];
}

function typeIconColor(type: AgendaType): string {
  return {
    task: 'text-amber-600',
    payment: 'text-rose-600',
    vendor: 'text-emerald-600',
    event: 'text-pink-600',
  }[type];
}

function typeIconComponent(type: AgendaType) {
  return { task: ListTodo, payment: WalletCards, vendor: Handshake, event: CalendarClock }[type];
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export default function Agenda() {
  const { wedding } = useWedding();
  const tasks = useWeddingTable<Task>('tasks', 'due_date');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'due_date');
  const timeline = useWeddingTable<TimelineItem>('timeline_items', 'time');

  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [month, setMonth] = useState<Date>(() => {
    const base = wedding?.wedding_date ? dateFromKey(wedding.wedding_date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = dateKey(new Date());
  const in7Days = dateKey(addDays(new Date(), 7));

  // ── Build all agenda items ──────────────────────────────────
  const agendaItems = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];

    tasks.rows
      .filter((t) => t.due_date && t.status !== 'concluída')
      .forEach((t) => {
        items.push({
          id: `task-${t.id}`,
          date: t.due_date as string,
          type: 'task',
          title: t.title,
          description: [t.responsible, `prioridade ${t.priority}`].filter(Boolean).join(' · '),
          href: t.status === 'atrasada' ? '/tarefas?filter=late' : '/tarefas',
        });
      });

    budgetItems.rows
      .filter((i) => i.due_date && i.payment_status !== 'pago' && i.payment_status !== 'cancelado')
      .forEach((i) => {
        items.push({
          id: `payment-${i.id}`,
          date: i.due_date as string,
          type: 'payment',
          title: i.name,
          description: `${i.category} · ${formatMoney(Number(i.contracted_value ?? 0) - Number(i.paid_value ?? 0))} pendente`,
          href: '/orcamento/vencimentos',
        });
      });

    vendors.rows
      .filter((v) => v.due_date)
      .forEach((v) => {
        items.push({
          id: `vendor-${v.id}`,
          date: v.due_date as string,
          type: 'vendor',
          title: v.name,
          description: `${v.category} · ${v.status}`,
          href: '/fornecedores',
          location: v.contact_name ?? undefined,
        });
      });

    if (wedding?.wedding_date) {
      items.push({
        id: `wedding-${wedding.id}`,
        date: wedding.wedding_date,
        time: wedding.ceremony_time,
        type: 'event',
        title: wedding.name || 'Casamento',
        description: [wedding.ceremony_place, wedding.party_place].filter(Boolean).join(' · '),
        href: '/configuracoes',
        location: wedding.ceremony_place ?? undefined,
      });

      timeline.rows.forEach((item) => {
        items.push({
          id: `timeline-${item.id}`,
          date: wedding.wedding_date as string,
          time: item.time,
          type: 'event',
          title: item.activity,
          description: [item.responsible, item.place].filter(Boolean).join(' · '),
          href: '/cronograma',
          location: item.place ?? undefined,
        });
      });
    }

    return items.sort((a, b) =>
      `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`, 'pt-BR', { numeric: true })
    );
  }, [budgetItems.rows, tasks.rows, timeline.rows, vendors.rows, wedding]);

  // ── Summary buckets ─────────────────────────────────────────
  const todayItems = useMemo(() => agendaItems.filter((i) => i.date === today), [agendaItems, today]);
  const weekItems = useMemo(() => agendaItems.filter((i) => i.date > today && i.date <= in7Days), [agendaItems, today, in7Days]);
  const paymentItems = useMemo(() => agendaItems.filter((i) => i.type === 'payment'), [agendaItems]);
  const overdueItems = useMemo(() => agendaItems.filter((i) => i.date < today && i.type !== 'event'), [agendaItems, today]);

  // ── Filtered list items ─────────────────────────────────────
  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'today': return todayItems;
      case 'week': return weekItems;
      case 'payments': return paymentItems;
      case 'overdue': return overdueItems;
      default: return agendaItems;
    }
  }, [filter, agendaItems, todayItems, weekItems, paymentItems, overdueItems]);

  // ── Period groups (only when filter = 'all') ─────────────────
  const groups = useMemo(() => {
    if (filter !== 'all') return null;
    const raw: { label: string; items: AgendaItem[]; accent?: string }[] = [
      { label: 'Hoje', items: agendaItems.filter((i) => i.date === today), accent: 'text-rose-500' },
      { label: 'Próximos 7 dias', items: agendaItems.filter((i) => i.date > today && i.date <= in7Days), accent: 'text-amber-600' },
      { label: 'Este mês', items: agendaItems.filter((i) => i.date > in7Days && sameMonth(i.date, new Date())) },
      { label: 'Mais adiante', items: agendaItems.filter((i) => !sameMonth(i.date, new Date()) && i.date > today) },
      { label: 'Atrasados', items: agendaItems.filter((i) => i.date < today && i.type !== 'event'), accent: 'text-rose-600' },
    ];
    const filtered = raw.filter((g) => g.items.length > 0);
    return filtered.length > 0 ? filtered : null;
  }, [agendaItems, today, in7Days, filter]);

  // ── Calendar data ────────────────────────────────────────────
  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const monthItems = useMemo(() => agendaItems.filter((i) => sameMonth(i.date, month)), [agendaItems, month]);
  const itemsByDate = useMemo(
    () => monthItems.reduce<Record<string, AgendaItem[]>>((acc, item) => {
      acc[item.date] = [...(acc[item.date] ?? []), item];
      return acc;
    }, {}),
    [monthItems]
  );

  const sidebarItems = selectedDay ? (itemsByDate[selectedDay] ?? []) : monthItems;
  const sidebarTitle = selectedDay
    ? `Compromissos em ${formatDayLabel(selectedDay)}`
    : `Compromissos de ${monthLabel(month)}`;

  function moveMonth(offset: number) {
    setMonth((c) => new Date(c.getFullYear(), c.getMonth() + offset, 1));
  }

  function goToToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(today);
    setView('calendar');
  }

  // ── Summary card config ──────────────────────────────────────
  const summaryCards = [
    {
      key: 'today' as FilterMode,
      label: 'Hoje',
      count: todayItems.length,
      activeColor: 'bg-rose-600 border-rose-600 text-white',
      inactiveColor: 'border-rose-200 bg-rose-50 text-rose-700',
      dot: 'bg-rose-400',
    },
    {
      key: 'week' as FilterMode,
      label: 'Próx. 7 dias',
      count: weekItems.length,
      activeColor: 'bg-amber-600 border-amber-600 text-white',
      inactiveColor: 'border-amber-200 bg-amber-50 text-amber-700',
      dot: 'bg-amber-400',
    },
    {
      key: 'payments' as FilterMode,
      label: 'Vencimentos',
      count: paymentItems.length,
      activeColor: 'bg-orange-600 border-orange-600 text-white',
      inactiveColor: 'border-orange-200 bg-orange-50 text-orange-700',
      dot: 'bg-orange-400',
    },
    {
      key: 'overdue' as FilterMode,
      label: 'Atrasados',
      count: overdueItems.length,
      activeColor: 'bg-red-700 border-red-700 text-white',
      inactiveColor: 'border-red-200 bg-red-50 text-red-700',
      dot: 'bg-red-500',
    },
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 text-[#2D2A26]">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title text-[#2D2A26]">Agenda</h1>
          <p className="mt-1 text-sm text-[#6F6760]">
            Próximos compromissos, vencimentos e tarefas importantes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[#E7E0D8] bg-white p-0.5">
            <button
              type="button"
              id="agenda-view-list"
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === 'list' ? 'bg-[#B76E79] text-white shadow-sm' : 'text-[#6F6760] hover:text-[#2D2A26]'
              }`}
            >
              <List size={14} />
              <span>Lista</span>
            </button>
            <button
              type="button"
              id="agenda-view-calendar"
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === 'calendar' ? 'bg-[#B76E79] text-white shadow-sm' : 'text-[#6F6760] hover:text-[#2D2A26]'
              }`}
            >
              <CalendarDays size={14} />
              <span>Calendário</span>
            </button>
          </div>

          {/* Hoje */}
          <button
            type="button"
            id="agenda-btn-today"
            className="btn-secondary h-9 border-[#E7E0D8] bg-white px-3 text-sm text-[#2D2A26]"
            onClick={goToToday}
          >
            Hoje
          </button>

          {/* Month nav — only in calendar view */}
          {view === 'calendar' && (
            <>
              <button
                type="button"
                className="btn-secondary h-9 border-[#E7E0D8] bg-white px-3 text-[#2D2A26]"
                onClick={() => moveMonth(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-36 rounded-lg border border-[#E7E0D8] bg-white px-3 py-2 text-center text-sm font-semibold capitalize text-[#2D2A26]">
                {monthLabel(month)}
              </div>
              <button
                type="button"
                className="btn-secondary h-9 border-[#E7E0D8] bg-white px-3 text-[#2D2A26]"
                onClick={() => moveMonth(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Summary / Filter chips ──────────────────────────── */}
      <section className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtros de período">
        {/* All */}
        <button
          type="button"
          id="agenda-filter-all"
          onClick={() => setFilter('all')}
          className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition ${
            filter === 'all'
              ? 'border-[#B76E79] bg-[#B76E79] text-white'
              : 'border-[#E7E0D8] bg-white text-[#6F6760] hover:border-[#D0B0A0] hover:text-[#2D2A26]'
          }`}
        >
          Todos · {agendaItems.length}
        </button>

        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            id={`agenda-filter-${card.key}`}
            onClick={() => setFilter(filter === card.key ? 'all' : card.key)}
            className={`shrink-0 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === card.key ? card.activeColor : `${card.inactiveColor} hover:opacity-80`
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${filter === card.key ? 'bg-white/70' : card.dot}`} />
            {card.label} · {card.count}
          </button>
        ))}
      </section>

      {/* ── Main Content ────────────────────────────────────── */}
      {view === 'list' ? (
        <ListViewContent filteredItems={filteredItems} groups={groups} filter={filter} today={today} />
      ) : (
        <CalendarViewContent
          monthDays={monthDays}
          month={month}
          itemsByDate={itemsByDate}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={(key) => setSelectedDay(selectedDay === key ? null : key)}
          sidebarItems={sidebarItems}
          sidebarTitle={sidebarTitle}
          hasSelection={!!selectedDay}
          onClearSelection={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// List View
// ═════════════════════════════════════════════════════════════

function ListViewContent({
  filteredItems,
  groups,
  filter,
  today,
}: {
  filteredItems: AgendaItem[];
  groups: { label: string; items: AgendaItem[]; accent?: string }[] | null;
  filter: string;
  today: string;
}) {
  if (filteredItems.length === 0) return <AgendaEmptyState />;

  if (groups && filter === 'all') {
    return (
      <div className="space-y-7">
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className={`text-[11px] font-bold uppercase tracking-widest ${group.accent ?? 'text-[#6F6760]'}`}>
                {group.label}
              </h2>
              <span className="rounded-full bg-[#E7E0D8] px-2 py-0.5 text-[10px] font-semibold text-[#B07C45]">
                {group.items.length}
              </span>
              <div className="flex-1 border-t border-[#E7E0D8]" />
            </div>
            <div className="space-y-2">
              {group.items.map((item) => (
                <AgendaCard key={item.id} item={item} today={today} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredItems.map((item) => (
        <AgendaCard key={item.id} item={item} today={today} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Agenda Card
// ─────────────────────────────────────────

function AgendaCard({ item, today }: { item: AgendaItem; today: string }) {
  const Icon = typeIconComponent(item.type);
  const isOverdue = item.date < today && item.type !== 'event';

  return (
    <article
      className={`group flex items-start gap-3 rounded-xl border p-3.5 transition hover:shadow-md ${typeCardBg(item.type)}`}
    >
      {/* Icon badge */}
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <Icon size={16} className={typeIconColor(item.type)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${typeBadgeClasses(item.type)}`}>
            {typeLabels[item.type]}
          </span>
          <span className={`text-xs font-medium ${isOverdue ? 'text-rose-600 font-semibold' : 'text-[#6F6760]'}`}>
            {formatDayLabel(item.date)}
            {item.time ? ` · ${item.time}` : ''}
            {isOverdue ? ' · Atrasado' : ''}
          </span>
        </div>
        <h3 className="mt-1 text-sm font-semibold leading-snug text-[#2D2A26]">{item.title}</h3>
        {item.description && (
          <p className="mt-0.5 truncate text-xs text-[#6F6760]">{item.description}</p>
        )}
        {item.location && (
          <p className="mt-0.5 text-xs text-[#6F6760]">📍 {item.location}</p>
        )}
      </div>

      {/* CTA */}
      <Link
        to={item.href}
        className="shrink-0 flex items-center gap-1 rounded-lg border border-[#E7E0D8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#B76E79] shadow-sm transition hover:bg-[#F3EEE8] hover:text-[#2D2A26]"
      >
        Abrir <ExternalLink size={11} />
      </Link>
    </article>
  );
}

// ═════════════════════════════════════════════════════════════
// Calendar View
// ═════════════════════════════════════════════════════════════

function CalendarViewContent({
  monthDays,
  month,
  itemsByDate,
  today,
  selectedDay,
  onSelectDay,
  sidebarItems,
  sidebarTitle,
  hasSelection,
  onClearSelection,
}: {
  monthDays: Date[];
  month: Date;
  itemsByDate: Record<string, AgendaItem[]>;
  today: string;
  selectedDay: string | null;
  onSelectDay: (key: string) => void;
  sidebarItems: AgendaItem[];
  sidebarTitle: string;
  hasSelection: boolean;
  onClearSelection: () => void;
}) {
  function dayKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_300px]">
      {/* ── Calendar Grid ──────────────────────────────────── */}
      <section className="rounded-xl border border-[#E7E0D8] bg-white p-3 shadow-[0_12px_28px_rgba(58,43,39,0.05)]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#8A8178]">
          {weekdays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {monthDays.map((day) => {
            const key = dayKey(day);
            const dayItems = itemsByDate[key] ?? [];
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isToday = key === today;
            const isSelected = key === selectedDay;
            const isOverdue = dayItems.some((i) => i.date < today && i.type !== 'event');
            const uniqueTypes = Array.from(new Set(dayItems.map((i) => i.type)));

            return (
              <button
                key={key}
                type="button"
                onClick={() => dayItems.length > 0 ? onSelectDay(key) : undefined}
                className={`group relative min-h-[72px] rounded-lg p-1.5 text-left transition ${
                  isSelected
                    ? 'bg-[#B76E79]/8 ring-2 ring-[#B76E79]/30 ring-inset'
                    : isCurrentMonth
                    ? 'hover:bg-[#F3EEE8]'
                    : 'opacity-35'
                } ${dayItems.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Day number */}
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold leading-none ${
                    isToday
                      ? 'bg-[#B76E79] text-white'
                      : isSelected
                      ? 'bg-[#B76E79]/15 text-[#2D2A26]'
                      : isOverdue
                      ? 'text-rose-600'
                      : 'text-[#2D2A26]'
                  }`}
                >
                  {day.getDate()}
                </span>

                {/* Type dots */}
                {dayItems.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {uniqueTypes.map((type) => (
                      <span key={type} className={`h-1.5 w-1.5 rounded-full ${typeDotColor(type as AgendaType)}`} />
                    ))}
                  </div>
                )}

                {/* Mini event labels */}
                {dayItems.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${
                          item.type === 'task' ? 'bg-amber-100 text-amber-800' :
                          item.type === 'payment' ? 'bg-rose-100 text-rose-800' :
                          item.type === 'vendor' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-pink-100 text-pink-800'
                        }`}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="px-1 text-[9px] text-[#6F6760]">+{dayItems.length - 2} mais</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <section className="flex flex-col rounded-xl border border-[#E7E0D8] bg-white p-3 shadow-[0_12px_28px_rgba(58,43,39,0.05)]">
        {/* Sidebar header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#E7E0D8] pb-3">
          <h2 className="text-sm font-semibold capitalize text-[#2D2A26] leading-snug">{sidebarTitle}</h2>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-[#6F6760]">{sidebarItems.length} itens</span>
            {hasSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="rounded-md p-1 text-[#6F6760] hover:bg-[#FAF8F5] hover:text-[#2D2A26]"
                aria-label="Ver mês completo"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar items */}
        {sidebarItems.length > 0 ? (
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: '520px' }}>
            {sidebarItems.map((item) => {
              const Icon = typeIconComponent(item.type);
              return (
                <article
                  key={item.id}
                  className={`rounded-lg border p-2.5 transition hover:shadow-sm ${typeCardBg(item.type)}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
                      <Icon size={12} className={typeIconColor(item.type)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${typeBadgeClasses(item.type)}`}>
                          {typeLabels[item.type]}
                        </span>
                        {item.time && <span className="text-[10px] text-[#6F6760]">{item.time}</span>}
                      </div>
                      <h3 className="mt-0.5 text-xs font-semibold leading-snug text-[#2D2A26]">{item.title}</h3>
                      {item.description && (
                        <p className="mt-0.5 truncate text-[10px] text-[#6F6760]">{item.description}</p>
                      )}
                      <Link
                        to={item.href}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#B76E79] hover:text-[#2D2A26] transition"
                      >
                        Abrir <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <CalendarDays size={28} className="text-[#B76E79]" />
            <p className="mt-2 text-sm font-semibold text-[#2D2A26]">Nenhum compromisso</p>
            <p className="mt-1 text-xs text-[#6F6760]">
              {hasSelection ? 'Sem itens neste dia.' : 'Sem itens neste mês.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Empty State
// ═════════════════════════════════════════════════════════════

function AgendaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E7E0D8] bg-white py-14 text-center">
      <CalendarDays size={36} className="text-[#B76E79]" />
      <h3 className="mt-3 text-base font-semibold text-[#2D2A26]">Nenhum compromisso encontrado</h3>
      <p className="mt-1 max-w-xs text-sm text-[#6F6760]">
        Adicione tarefas, vencimentos ou eventos para acompanhar sua agenda.
      </p>
    </div>
  );
}
