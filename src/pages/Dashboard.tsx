import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Heart,
  ListChecks,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AnimatedNumber, AnimatedProgressBar, SkeletonCard, SkeletonChart, SkeletonList } from '../components/Animated';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Guest, Task, Vendor } from '../types';
import { daysUntil, formatDate, formatMoney } from '../utils/format';
import { calculateFinancialHealth, getPendingValue, isBudgetOverdue } from '../utils/finance';

/* â”€â”€ Chart palette aligned with new design system â”€â”€ */
const semanticColors = {
  blue: '#2563EB',
  purple: '#8B5CF6',
  green: '#22C55E',
  amber: '#F59E0B',
  orange: '#F97316',
  red: '#EF4444',
  rose: '#E11D48',
  gray: '#94A3B8'
};

const financeColors = [semanticColors.blue, semanticColors.purple, semanticColors.green, semanticColors.amber];
const paletteCycle = [semanticColors.blue, semanticColors.green, semanticColors.amber, semanticColors.purple, semanticColors.rose, semanticColors.orange, semanticColors.gray];
const statusColors: Record<string, string> = {
  confirmado: semanticColors.green,
  confirmada: semanticColors.green,
  confirmados: semanticColors.green,
  contratado: semanticColors.green,
  contratada: semanticColors.green,
  pago: semanticColors.green,
  paga: semanticColors.green,
  concluida: semanticColors.green,
  concluída: semanticColors.green,
  concluido: semanticColors.green,
  concluído: semanticColors.green,
  pendente: semanticColors.amber,
  pendentes: semanticColors.amber,
  pesquisando: semanticColors.gray,
  cotado: semanticColors.amber,
  'em andamento': semanticColors.amber,
  recusado: semanticColors.red,
  recusada: semanticColors.red,
  recusados: semanticColors.red,
  cancelado: semanticColors.red,
  cancelada: semanticColors.red,
  atrasado: semanticColors.red,
  atrasada: semanticColors.red,
  vencido: semanticColors.red,
  vencida: semanticColors.red,
  vencidos: semanticColors.red
};
const financialHealthColors = {
  saudavel: semanticColors.green,
  atencao: semanticColors.amber,
  preocupante: semanticColors.orange,
  critica: semanticColors.red,
  sem_dados: semanticColors.gray
};

/* â”€â”€ Panel component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Panel({
  title, icon, children, className = '',
}: {
  title: string; icon: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section
      className={`panel p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="rounded-xl bg-w-rose-lt p-1.5 text-w-rose">{icon}</span>
        <h2 className="text-sm font-bold text-w-text sm:text-base">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
type KpiProps = {
  title: string;
  mobileTitle?: string;
  value: string | number;
  numericValue?: number;
  formatValue?: (value: number) => string;
  mobileValue?: string | number;
  helper: ReactNode;
  mobileHelper?: ReactNode;
  icon: ReactNode;
  tone?: 'default' | 'rose' | 'gold' | 'red' | 'green';
  onClick: () => void;
};

const kpiTones = {
  default: { icon: 'bg-white text-w-muted ring-w-border',       accent: 'border-w-border bg-white',          value: 'text-w-text',    bar: 'bg-w-border' },
  rose:    { icon: 'bg-white text-w-rose ring-rose-100',         accent: 'border-rose-100 bg-rose-50/50',     value: 'text-w-rose',    bar: 'bg-w-rose' },
  gold:    { icon: 'bg-white text-[#D97706] ring-amber-100',     accent: 'border-amber-100 bg-amber-50/55',   value: 'text-[#B45309]', bar: 'bg-[#F59E0B]' },
  red:     { icon: 'bg-white text-[#DC2626] ring-red-100',       accent: 'border-red-100 bg-red-50/50',       value: 'text-[#DC2626]', bar: 'bg-[#DC2626]' },
  green:   { icon: 'bg-white text-[#16A34A] ring-emerald-100',   accent: 'border-emerald-100 bg-emerald-50/50', value: 'text-[#15803D]', bar: 'bg-[#16A34A]' },
};

function KpiCard({
  title, mobileTitle, value, numericValue, formatValue, mobileValue, helper, mobileHelper,
  icon, tone = 'default', onClick,
}: KpiProps) {
  const t = kpiTones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-float min-[380px]:p-3.5 sm:p-4 ${t.accent}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-[18px] text-w-faint sm:hidden">
            {mobileTitle ?? title}
          </p>
          <p className="hidden text-[13px] font-semibold leading-[18px] text-w-faint sm:block">
            {title}
          </p>
          <p className={`mt-1 min-w-0 truncate text-2xl font-bold leading-8 tabular-nums sm:text-[32px] sm:leading-9 ${t.value}`}>
            <span className="block min-w-0 truncate sm:hidden">
              {mobileValue ?? (numericValue !== undefined ? <AnimatedNumber value={numericValue} format={formatValue} /> : value)}
            </span>
            <span className="hidden sm:inline">
              {numericValue !== undefined ? <AnimatedNumber value={numericValue} format={formatValue} /> : value}
            </span>
          </p>
          <p className="mt-1 line-clamp-1 text-[13px] font-normal leading-[18px] text-w-muted sm:hidden">
            {mobileHelper ?? helper}
          </p>
          <p className="mt-1 hidden text-[13px] font-normal leading-[18px] text-w-muted sm:line-clamp-2 sm:block">
            {helper}
          </p>
        </div>
        <span className={`shrink-0 rounded-xl p-1.5 ring-1 min-[380px]:p-2 ${t.icon} transition-transform duration-150 group-hover:scale-110`}>
          {icon}
        </span>
      </div>
    </button>
  );
}

/* â”€â”€ Progress bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ProgressBar({ value, color = '#E11D48' }: { value: number; color?: string }) {
  return <AnimatedProgressBar value={value} color={color} duration={700} />;
}

/* â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function EmptyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-w-border-md bg-w-surface p-5">
      <p className="text-sm font-semibold text-w-text">{title}</p>
      <p className="mt-1 text-sm text-w-muted">{text}</p>
    </div>
  );
}

function ChartLegend({ items }: { items: { name: string; value?: number; color: string; format?: (value: number) => string }[] }) {
  return (
    <div className="mt-3 grid gap-2 text-xs text-w-muted sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="truncate">{item.name}</span>
          </span>
          {item.value !== undefined && <strong className="shrink-0 text-w-text">{item.format ? item.format(item.value) : item.value}</strong>}
        </div>
      ))}
    </div>
  );
}

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000)     return `R$ ${Math.round(value / 1_000).toLocaleString('pt-BR')}k`;
  return formatMoney(value).replace(',00', '');
}

function firstName(value?: string | null) {
  return String(value ?? '').trim().split(/\s+/)[0] || '';
}

function initialsFromNames(bride?: string | null, groom?: string | null, fallback?: string | null) {
  const names = [bride, groom].filter(Boolean) as string[];
  const source = names.length ? names : [fallback ?? ''];
  return source
    .map((name) => String(name).trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'C';
}

function normalizeText(value?: string | null) {
  return String(value ?? 'Sem categoria').trim() || 'Sem categoria';
}

function normalizeKey(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function displayStatus(value: string) {
  const key = normalizeKey(value);
  if (key === 'concluida') return 'Concluída';
  if (key === 'em andamento') return 'Em andamento';
  if (key === 'atrasada') return 'Atrasada';
  if (key === 'pendente') return 'Pendente';
  if (key === 'contratado') return 'Contratado';
  if (key === 'cotado') return 'Cotado';
  if (key === 'cancelado') return 'Cancelado';
  if (key === 'pesquisando') return 'Pesquisando';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function colorForStatus(value: string) {
  return statusColors[normalizeKey(value)] ?? semanticColors.gray;
}

function budgetVisual(pct: number, planned: number, contracted: number): { tone: KpiProps['tone']; color: string } {
  if (!planned) return contracted > 0 ? { tone: 'red', color: semanticColors.red } : { tone: 'default', color: semanticColors.gray };
  if (pct > 100) return { tone: 'red', color: semanticColors.red };
  if (pct >= 80) return { tone: 'gold', color: semanticColors.amber };
  return { tone: 'green', color: semanticColors.green };
}

function monthKey(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
}

function isLateTask(task: Task) {
  return Boolean(normalizeKey(task.status) !== 'concluida' && task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
}

function taskPriorityRank(task: Task) {
  return ({ alta: 0, media: 1, baixa: 2 } as Record<string, number>)[normalizeKey(task.priority)] ?? 3;
}

/* â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function Dashboard() {
  const navigate = useNavigate();
  const { wedding } = useWedding();
  const guests  = useWeddingTable<Guest>('guests');
  const budget  = useWeddingTable<BudgetItem>('budget_items');
  const vendors = useWeddingTable<Vendor>('vendors');
  const tasks   = useWeddingTable<Task>('tasks');

  const countPeople = (rows: Guest[]) =>
    rows.reduce((sum, g) => sum + 1 + Number(g.companions ?? 0), 0);

  const totalGuests     = countPeople(guests.rows);
  const confirmedGuests = countPeople(guests.rows.filter((g) => g.invite_status === 'confirmado'));
  const refusedGuests   = countPeople(guests.rows.filter((g) => g.invite_status === 'recusado'));
  const pendingGuests   = countPeople(guests.rows.filter((g) => !['confirmado', 'recusado'].includes(g.invite_status)));
  const adults          = guests.rows.filter((g) => g.guest_type === 'adulto').length;
  const children        = guests.rows.filter((g) => g.guest_type === 'criança').length;
  const special         = guests.rows.filter((g) => g.guest_type === 'especial').length;
  const confirmPct      = totalGuests ? Math.round((confirmedGuests / totalGuests) * 100) : 0;

  const planned         = Number(wedding?.planned_budget ?? 0);
  const contracted      = budget.rows.reduce((s, i) => s + Number(i.contracted_value ?? 0), 0);
  const paid            = budget.rows.reduce((s, i) => s + Number(i.paid_value ?? 0), 0);
  const pendingValue    = Math.max(0, contracted - paid);
  const available       = planned - contracted;
  const budgetPct       = planned ? Math.round((contracted / planned) * 100) : 0;
  const overdueItems    = budget.rows.filter(isBudgetOverdue);
  const overduePaymentsCount = overdueItems.length;
  const overduePaymentsValue =
    overdueItems.reduce((sum, item) => sum + getPendingValue(item.contracted_value, item.paid_value), 0);
  const lateTasks       = tasks.rows.filter(isLateTask);
  const budgetState = budgetVisual(budgetPct, planned, contracted);

  const coupleName = [wedding?.bride_name, wedding?.groom_name].filter(Boolean).join(' & ') || wedding?.name || 'Dashboard';
  const shortName = [firstName(wedding?.bride_name), firstName(wedding?.groom_name)].filter(Boolean).join(' & ') || coupleName;
  const coupleInitials = initialsFromNames(wedding?.bride_name, wedding?.groom_name, wedding?.name);
  const daysLeft = wedding?.wedding_date ? daysUntil(wedding.wedding_date) : null;

  const financeChart = [
    { name: 'Planejado',   value: planned },
    { name: 'Contratado',  value: contracted },
    { name: 'Pago',        value: paid },
    { name: 'Pendente',    value: pendingValue },
  ];
  const hasFinanceData = financeChart.some((i) => i.value > 0);

  const guestStatusData = [
    { name: 'Confirmados', value: confirmedGuests, color: semanticColors.green },
    { name: 'Pendentes',   value: pendingGuests, color: semanticColors.amber },
    { name: 'Recusados',   value: refusedGuests, color: semanticColors.red },
  ].filter((i) => i.value > 0);

  const categorySpendData = useMemo(() => {
    const totals = new Map<string, number>();
    budget.rows.forEach((item) => {
      const category = normalizeText(item.category);
      totals.set(category, (totals.get(category) ?? 0) + Number(item.contracted_value ?? item.estimated_value ?? 0));
    });
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [budget.rows]);

  const monthlyPaymentsData = useMemo(() => {
    const totals = new Map<string, number>();
    budget.rows.forEach((item) => {
      const key = monthKey(item.due_date);
      const value = getPendingValue(item.contracted_value, item.paid_value);
      if (value > 0) totals.set(key, (totals.get(key) ?? 0) + value);
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value })).slice(0, 8);
  }, [budget.rows]);

  const taskStatusData = useMemo(() => {
    const statuses = ['pendente', 'em andamento', 'concluída', 'atrasada'];
    return statuses.map((status) => ({
      name: displayStatus(status),
      key: normalizeKey(status),
      value: status === 'atrasada' ? lateTasks.length : tasks.rows.filter((task) => normalizeKey(task.status) === normalizeKey(status)).length
    })).filter((item) => item.value > 0);
  }, [lateTasks.length, tasks.rows]);

  const vendorStatusData = useMemo(() => {
    const totals = new Map<string, number>();
    vendors.rows.forEach((vendor) => {
      const status = normalizeText(vendor.status);
      totals.set(status, (totals.get(status) ?? 0) + 1);
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [vendors.rows]);

  const health = calculateFinancialHealth({
    orcamentoPlanejado: planned,
    totalContratado: contracted,
    totalPago: paid,
    itensFinanceiros: budget.rows,
    pagamentos: [],
    fornecedores: vendors.rows,
    dataCasamento: wedding?.wedding_date
  });
  const healthColor = financialHealthColors[health.status];

  const upcomingItems = useMemo(() => {
    const taskItems = tasks.rows
      .filter((t) => normalizeKey(t.status) !== 'concluida')
      .map((t) => ({
        id:    `task-${t.id}`,
        title: t.title,
        meta:  t.due_date ? `Tarefa · ${formatDate(t.due_date)}` : 'Tarefa pendente',
        date:  t.due_date ?? '9999-12-31',
        alert: isLateTask(t),
        rank:  taskPriorityRank(t),
      }));
    const payItems = budget.rows
      .filter((i) => getPendingValue(i.contracted_value, i.paid_value) > 0)
      .map((i) => ({
        id:    `pay-${i.id}`,
        title: i.name,
        meta:  i.due_date ? `Pagamento · ${formatDate(i.due_date)}` : 'Sem vencimento',
        date:  i.due_date ?? '9999-12-31',
        alert: isBudgetOverdue(i),
        rank:  2,
      }));
    return [...taskItems, ...payItems]
      .sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank)
      .slice(0, 5);
  }, [budget.rows, tasks.rows]);

  const loading = guests.loading || budget.loading || vendors.loading || tasks.loading;

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-page-enter">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="skeleton-shimmer h-8 w-56 rounded-full" />
            <div className="skeleton-shimmer mt-3 h-4 w-72 rounded-full" />
          </div>
          <div className="skeleton-shimmer h-8 w-28 rounded-full" />
        </header>
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <SkeletonCard key={item} />)}
        </section>
        <section className="grid gap-3 sm:gap-4 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonList rows={3} />
        </section>
        <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">

      {/* Hero header */}
      <header className="flex flex-col gap-3 rounded-3xl border border-w-border bg-white/75 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-w-rose-lt text-base font-extrabold text-w-rose ring-1 ring-w-rose-md">
            {coupleInitials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-w-text sm:text-2xl">{shortName}</h1>
            <p className="mt-0.5 truncate text-xs font-medium text-w-muted sm:text-sm">
              {coupleName !== shortName ? `${coupleName} · ` : ''}Resumo do casamento
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-w-rose-md bg-w-rose-lt px-3 py-1.5 text-xs font-bold text-w-rose">
          <Clock3 size={12} />
          {daysLeft !== null
            ? daysLeft > 0
              ? `${daysLeft} dias restantes`
              : daysLeft === 0
                ? 'Hoje é o grande dia'
                : `${Math.abs(daysLeft)} dias após`
            : 'Data não definida'}
        </span>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title="Convidados"
          value={totalGuests}
          numericValue={totalGuests}
          helper={(
            <>
              <span className="font-semibold text-[#16A34A]">{confirmedGuests} confirmados</span>
              <span className="text-w-muted"> · </span>
              <span className="font-semibold text-[#D97706]">{pendingGuests} pendentes</span>
              {!!refusedGuests && (
                <>
                  <span className="text-w-muted"> · </span>
                  <span className="font-semibold text-[#DC2626]">{refusedGuests} recusados</span>
                </>
              )}
            </>
          )}
          mobileHelper={<span className="font-semibold text-[#D97706]">{pendingGuests} pendentes</span>}
          icon={<Users size={18} />}
          tone="rose"
          onClick={() => navigate('/convidados')}
        />
        <KpiCard
          title="Orçamento"
          value={formatMoney(planned)}
          numericValue={planned}
          formatValue={(value) => formatMoney(value)}
          mobileValue={compactMoney(planned)}
          helper={`${formatMoney(contracted)} contratado (${budgetPct}%)`}
          mobileHelper={`${budgetPct}% usado`}
          icon={<WalletCards size={18} />}
          tone={budgetState.tone}
          onClick={() => navigate('/orcamento')}
        />
        <KpiCard
          title="Pagamentos vencidos"
          mobileTitle="Vencidos"
          value={overduePaymentsCount}
          numericValue={overduePaymentsCount}
          helper={
            overduePaymentsCount
              ? `${formatMoney(overduePaymentsValue)} em atraso`
              : 'Nenhum em atraso'
          }
          mobileHelper={overduePaymentsCount ? `${overduePaymentsCount} em atraso` : 'Ok'}
          icon={<AlertTriangle size={18} />}
          tone={overduePaymentsCount > 0 ? 'red' : 'green'}
          onClick={() => navigate('/orcamento/vencimentos?filter=overdue')}
        />
        <KpiCard
          title="Pendências atrasadas"
          mobileTitle="Agenda"
          value={lateTasks.length}
          numericValue={lateTasks.length}
          helper={lateTasks.length ? 'Atenção: há pendências atrasadas' : 'Nenhuma pendência atrasada'}
          mobileHelper={lateTasks.length ? `${lateTasks.length} atrasadas` : 'Em dia'}
          icon={<ListChecks size={18} />}
          tone={lateTasks.length > 0 ? 'gold' : 'green'}
          onClick={() => navigate('/agenda')}
        />
      </section>

      {/* Detail panels */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-3">

        {/* Convidados */}
        <Panel title="Convidados" icon={<Users size={16} />} className="order-3 xl:order-1">
          {totalGuests ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-w-green-lt p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#16A34A]">Confirmados</p>
                  <p className="mt-1 text-xl font-bold text-[#16A34A]">{confirmedGuests}</p>
                </div>
                <div className="rounded-2xl bg-w-gold-lt p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">Pendentes</p>
                  <p className="mt-1 text-xl font-bold text-[#D97706]">{pendingGuests}</p>
                </div>
                <div className="rounded-2xl bg-w-red-lt p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">Recusados</p>
                  <p className="mt-1 text-xl font-bold text-[#DC2626]">{refusedGuests}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-w-muted">
                <div className="flex justify-between"><span>Total</span><strong className="text-w-text">{totalGuests}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Adultos</span><strong className="text-w-text">{adults}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Crianças</span><strong className="text-w-text">{children}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Especiais</span><strong className="text-w-text">{special}</strong></div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs text-w-muted">
                  <span>Confirmação</span>
                  <strong className="text-w-text">{confirmPct}%</strong>
                </div>
                <ProgressBar value={confirmPct} color="#22C55E" />
              </div>
            </div>
          ) : (
            <EmptyBox title="Nenhum convidado" text="Adicione convidados para acompanhar confirmações." />
          )}
        </Panel>

        {/* Financeiro */}
        <Panel title="Financeiro" icon={<CircleDollarSign size={16} />} className="order-2 xl:order-2">
          {hasFinanceData ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-xs text-w-muted">
                  <span>Orçamento usado</span>
                  <strong className={budgetPct > 100 ? 'text-[#DC2626]' : budgetPct >= 80 ? 'text-[#D97706]' : 'text-[#16A34A]'}>{budgetPct}%</strong>
                </div>
                <ProgressBar value={budgetPct} color={budgetState.color} />
              </div>
              <div className="space-y-1.5 text-sm text-w-muted">
                <div className="flex justify-between"><span>Planejado</span><strong className="text-w-text">{formatMoney(planned)}</strong></div>
                <div className="flex justify-between"><span>Contratado</span><strong className="text-w-text">{formatMoney(contracted)}</strong></div>
                <div className="flex justify-between"><span>Pago</span><strong className="text-[#16A34A]">{formatMoney(paid)}</strong></div>
                <div className="flex justify-between"><span>Pendente</span><strong className="text-[#D97706]">{formatMoney(pendingValue)}</strong></div>
                <div className="flex justify-between border-t border-w-border pt-2">
                  <span>Saldo</span>
                  <strong className={available < 0 ? 'text-[#DC2626]' : 'text-w-text'}>{formatMoney(available)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <EmptyBox title="Nenhum dado financeiro" text="Cadastre valores para acompanhar o orçamento." />
          )}
        </Panel>

        {/* Upcoming agenda */}
        <Panel title="Próximos itens da agenda" icon={<CalendarClock size={16} />} className="order-1 xl:order-3">
          {upcomingItems.length ? (
            <div className="space-y-2">
              {upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className={`group rounded-xl border p-3 transition-all duration-150 hover:shadow-soft ${
                    item.alert ? 'border-[#EF4444]/25 bg-w-red-lt' : 'border-w-border bg-w-surface hover:bg-w-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold text-w-text">{item.title}</p>
                      <p className={`mt-0.5 text-xs ${item.alert ? 'text-[#DC2626]' : 'text-w-muted'}`}>
                        {item.alert ? 'Atrasado' : item.meta}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-w-faint transition group-hover:text-w-rose" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBox title="Nenhum item pendente" text="Os próximos itens da Agenda aparecerão aqui." />
          )}
        </Panel>
      </section>

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel title="Financeiro: planejado x realizado" icon={<WalletCards size={16} />} className={!hasFinanceData ? 'hidden sm:block' : ''}>
          {hasFinanceData ? (
            <>
              <div className="h-56 sm:h-64">
                <ResponsiveContainer>
                  <BarChart data={financeChart} barSize={38}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(v) => formatMoney(Number(v)).replace(',00', '')} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} formatter={(v) => formatMoney(Number(v))} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800}>
                      {financeChart.map((_, i) => <Cell key={i} fill={financeColors[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={financeChart.map((item, index) => ({ ...item, color: financeColors[index], format: formatMoney }))} />
            </>
          ) : (
            <EmptyBox title="Gráfico indisponível" text="Cadastre valores financeiros para visualizar." />
          )}
        </Panel>

        <Panel title="Convidados por status" icon={<CheckCircle2 size={16} />} className={!guestStatusData.length ? 'hidden sm:block' : ''}>
          {guestStatusData.length ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px] md:items-center">
              <div className="h-56 sm:h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={guestStatusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3} strokeWidth={0} isAnimationActive animationDuration={800}>
                      {guestStatusData.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-w-text">{totalGuests}</p>
                <p className="text-xs font-semibold text-w-muted">pessoas na lista</p>
                <ChartLegend items={guestStatusData} />
              </div>
            </div>
          ) : (
            <EmptyBox title="Nenhum convidado" text="Adicione convidados para ver a distribuição." />
          )}
        </Panel>

        <Panel title="Gastos por categoria" icon={<CircleDollarSign size={16} />} className={!categorySpendData.length ? 'hidden sm:block' : ''}>
          {categorySpendData.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={categorySpendData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(v) => compactMoney(Number(v))} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={86} tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800}>
                    {categorySpendData.map((_, i) => <Cell key={i} fill={paletteCycle[i % paletteCycle.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Sem categorias" text="Cadastre itens financeiros para ver os gastos por categoria." />
          )}
        </Panel>

        <Panel title="Pagamentos por mês" icon={<CalendarClock size={16} />} className={!monthlyPaymentsData.length ? 'hidden sm:block' : ''}>
          {monthlyPaymentsData.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={monthlyPaymentsData} barSize={34}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(v) => compactMoney(Number(v))} axisLine={false} tickLine={false} width={70} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} formatter={(v) => formatMoney(Number(v))} />
                  <Bar dataKey="value" fill={semanticColors.amber} radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Sem vencimentos" text="Adicione datas de pagamento para ver a distribuição mensal." />
          )}
        </Panel>

        <Panel title="Tarefas por status" icon={<ListChecks size={16} />} className={!taskStatusData.length ? 'hidden sm:block' : ''}>
          {taskStatusData.length ? (
            <>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={86} paddingAngle={3} strokeWidth={0} isAnimationActive animationDuration={800}>
                      {taskStatusData.map((item) => <Cell key={item.name} fill={statusColors[item.key] ?? semanticColors.gray} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={taskStatusData.map((item) => ({ ...item, color: statusColors[item.key] ?? semanticColors.gray }))} />
            </>
          ) : (
            <EmptyBox title="Sem tarefas" text="Crie tarefas para acompanhar o andamento do planejamento." />
          )}
        </Panel>

        <Panel title="Fornecedores por status" icon={<ShieldCheck size={16} />} className={!vendorStatusData.length ? 'hidden sm:block' : ''}>
          {vendorStatusData.length ? (
            <>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={vendorStatusData} barSize={34}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800}>
                      {vendorStatusData.map((item, i) => <Cell key={item.name} fill={colorForStatus(item.name) ?? paletteCycle[i % paletteCycle.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={vendorStatusData.map((item, i) => ({ ...item, color: colorForStatus(item.name) ?? paletteCycle[i % paletteCycle.length] }))} />
            </>
          ) : (
            <EmptyBox title="Sem fornecedores" text="Cadastre fornecedores para acompanhar contratações." />
          )}
        </Panel>
      </section>

      <Panel title="Saúde financeira" icon={<ShieldCheck size={16} />}>
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
          <div className="rounded-3xl border border-w-border bg-w-surface p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-w-faint">Score</p>
            <p className="mt-2 text-4xl font-extrabold" style={{ color: healthColor }}>{health.score}</p>
            <p className="mt-1 text-sm font-bold text-w-text">{health.label}</p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex justify-between text-xs text-w-muted">
                <span>Risco financeiro</span>
                <strong className="text-w-text">{health.riscoLabel} · {health.risco}%</strong>
              </div>
              <ProgressBar value={health.risco} color={healthColor} />
            </div>
            <div className="rounded-2xl border border-w-border bg-w-card p-3 text-sm text-w-muted">
              <strong className="block text-w-text">Motivo</strong>
              <span>{health.motivo}</span>
            </div>
            <div className="grid gap-2 text-sm text-w-muted sm:grid-cols-4">
              <div className="rounded-2xl bg-w-surface p-3">
                <span>Pago</span>
                <strong className="mt-1 block text-w-text">{Math.round(health.detalhes.percentualPago * 100)}%</strong>
              </div>
              <div className="rounded-2xl bg-w-surface p-3">
                <span>Pendente</span>
                <strong className="mt-1 block text-w-text">{formatMoney(health.detalhes.totalPendente)}</strong>
              </div>
              <div className="rounded-2xl bg-w-surface p-3">
                <span>Atrasado</span>
                <strong className={health.detalhes.valorAtrasado > 0 ? 'mt-1 block text-[#DC2626]' : 'mt-1 block text-w-text'}>
                  {formatMoney(health.detalhes.valorAtrasado)}
                </strong>
              </div>
              <div className="rounded-2xl bg-w-surface p-3">
                <span>Próx. 30 dias</span>
                <strong className="mt-1 block text-w-text">{formatMoney(health.detalhes.valorVencendoEm30Dias)}</strong>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

