import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Heart,
  ListChecks,
  Users,
  WalletCards,
} from 'lucide-react';
import { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Guest, Task, Vendor } from '../types';
import { daysUntil, formatDate, formatMoney } from '../utils/format';
import { getPendingValue, isBudgetOverdue } from '../utils/finance';

/* ── Chart palette aligned with new design system ── */
const chartColors = ['#E11D48', '#F59E0B', '#22C55E', '#EF4444'];

/* ── Panel component ─────────────────────────────────────────────── */
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

/* ── KPI Card ────────────────────────────────────────────────────── */
type KpiProps = {
  title: string;
  mobileTitle?: string;
  value: string | number;
  mobileValue?: string | number;
  helper: string;
  mobileHelper?: string;
  icon: ReactNode;
  tone?: 'default' | 'rose' | 'gold' | 'red' | 'green';
  onClick: () => void;
};

const kpiTones = {
  default: { icon: 'bg-w-surface text-w-muted',       ring: 'border-w-border',    value: 'text-w-text'     },
  rose:    { icon: 'bg-w-rose-lt text-w-rose',         ring: 'border-w-rose/30',   value: 'text-w-rose'     },
  gold:    { icon: 'bg-w-gold-lt text-[#D97706]',      ring: 'border-w-gold/30',   value: 'text-[#D97706]'  },
  red:     { icon: 'bg-w-red-lt text-[#DC2626]',       ring: 'border-[#EF4444]/25 ring-1 ring-[#EF4444]/10', value: 'text-[#DC2626]' },
  green:   { icon: 'bg-w-green-lt text-[#16A34A]',     ring: 'border-w-border',    value: 'text-[#16A34A]'  },
};

function KpiCard({
  title, mobileTitle, value, mobileValue, helper, mobileHelper,
  icon, tone = 'default', onClick,
}: KpiProps) {
  const t = kpiTones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border bg-w-card p-3.5 text-left shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-float sm:p-4 ${t.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-w-faint sm:hidden">
            {mobileTitle ?? title}
          </p>
          <p className="hidden text-[10px] font-bold uppercase tracking-widest text-w-faint sm:block">
            {title}
          </p>
          <p className={`mt-1 text-xl font-bold sm:text-2xl ${t.value}`}>
            <span className="sm:hidden">{mobileValue ?? value}</span>
            <span className="hidden sm:inline">{value}</span>
          </p>
          <p className="mt-1 line-clamp-1 text-[11px] text-w-muted sm:hidden">
            {mobileHelper ?? helper}
          </p>
          <p className="mt-1 hidden text-xs text-w-muted sm:line-clamp-2 sm:block">
            {helper}
          </p>
        </div>
        <span className={`shrink-0 rounded-xl p-2 ${t.icon} transition-transform duration-150 group-hover:scale-110`}>
          {icon}
        </span>
      </div>
    </button>
  );
}

/* ── Progress bar ────────────────────────────────────────────────── */
function ProgressBar({ value, color = '#E11D48' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-w-border">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-w-border-md bg-w-surface p-5">
      <p className="text-sm font-semibold text-w-text">{title}</p>
      <p className="mt-1 text-sm text-w-muted">{text}</p>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000)     return `R$ ${Math.round(value / 1_000).toLocaleString('pt-BR')}k`;
  return formatMoney(value).replace(',00', '');
}

function isLateTask(task: Task) {
  return Boolean(task.status !== 'concluída' && task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
}
function taskPriorityRank(task: Task) {
  return ({ alta: 0, média: 1, baixa: 2 } as Record<string, number>)[task.priority] ?? 3;
}

/* ── Dashboard ───────────────────────────────────────────────────── */
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
  const lateTasks       = tasks.rows.filter(isLateTask);
  const contractedVendors = vendors.rows.filter((v) => v.status === 'contratado').length;

  const coupleName = [wedding?.bride_name, wedding?.groom_name].filter(Boolean).join(' & ') || wedding?.name || 'Dashboard';
  const shortName  = [wedding?.bride_name, wedding?.groom_name]
    .filter(Boolean)
    .map((n) => String(n).trim().split(/\s+/)[0])
    .join(' & ') || coupleName;
  const daysLeft = wedding?.wedding_date ? daysUntil(wedding.wedding_date) : null;

  const financeChart = [
    { name: 'Planejado',   value: planned },
    { name: 'Contratado',  value: contracted },
    { name: 'Pago',        value: paid },
    { name: 'Pendente',    value: pendingValue },
  ];
  const hasFinanceData = financeChart.some((i) => i.value > 0);

  const guestStatusData = [
    { name: 'Confirmados', value: confirmedGuests },
    { name: 'Pendentes',   value: pendingGuests },
    { name: 'Recusados',   value: refusedGuests },
  ].filter((i) => i.value > 0);

  const upcomingItems = useMemo(() => {
    const taskItems = tasks.rows
      .filter((t) => t.status !== 'concluída')
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">

      {/* ── Hero header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 sm:hidden">
            <Heart size={14} className="text-w-rose" />
            <h1 className="text-lg font-bold text-w-text">{shortName}</h1>
          </div>
          <h1 className="hidden text-3xl font-extrabold tracking-tight text-w-text sm:block">
            {coupleName}
          </h1>
          <p className="mt-0.5 text-xs text-w-muted sm:mt-1 sm:text-sm">
            Resumo do casamento
            {daysLeft !== null
              ? daysLeft > 0
                ? ` · ${daysLeft} dias restantes`
                : daysLeft === 0
                  ? ' · Hoje é o grande dia! 🎉'
                  : ` · ${Math.abs(daysLeft)} dias após o casamento`
              : ' · Data não definida'}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-w-rose-lt px-3 py-1.5 text-xs font-semibold text-w-rose">
          <Clock3 size={12} />
          {daysLeft !== null && daysLeft > 0 ? `${daysLeft} dias` : 'Planejamento'}
        </span>
      </header>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title="Convidados"
          value={totalGuests}
          helper={`${confirmedGuests} confirmados · ${pendingGuests} pendentes`}
          mobileHelper={`${confirmedGuests} confirmados`}
          icon={<Users size={18} />}
          tone="default"
          onClick={() => navigate('/convidados')}
        />
        <KpiCard
          title="Orçamento"
          value={formatMoney(planned)}
          mobileValue={compactMoney(planned)}
          helper={`${formatMoney(contracted)} contratado (${budgetPct}%)`}
          mobileHelper={`${budgetPct}% usado`}
          icon={<WalletCards size={18} />}
          tone={planned > 0 && contracted > planned ? 'red' : 'default'}
          onClick={() => navigate('/orcamento')}
        />
        <KpiCard
          title="Pagamentos vencidos"
          mobileTitle="Vencidos"
          value={overdueItems.length}
          helper={
            overdueItems.length
              ? `${formatMoney(overdueItems.reduce((s, i) => s + getPendingValue(i.contracted_value, i.paid_value), 0))} em atraso`
              : 'Nenhum em atraso'
          }
          mobileHelper={overdueItems.length ? `${overdueItems.length} em atraso` : 'Ok'}
          icon={<AlertTriangle size={18} />}
          tone={overdueItems.length > 0 ? 'red' : 'green'}
          onClick={() => navigate('/orcamento/vencimentos?filter=overdue')}
        />
        <KpiCard
          title="Tarefas atrasadas"
          mobileTitle="Tarefas"
          value={lateTasks.length}
          helper={lateTasks.length ? 'Abrir tarefas vencidas' : `${contractedVendors} fornecedores contratados`}
          mobileHelper={lateTasks.length ? `${lateTasks.length} atrasadas` : 'Em dia'}
          icon={<ListChecks size={18} />}
          tone={lateTasks.length > 0 ? 'gold' : 'green'}
          onClick={() => navigate('/tarefas?filter=late')}
        />
      </section>

      {/* ── Detail panels ── */}
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
                  <strong className={budgetPct > 100 ? 'text-[#DC2626]' : 'text-w-text'}>{budgetPct}%</strong>
                </div>
                <ProgressBar value={budgetPct} color={budgetPct > 100 ? '#EF4444' : '#E11D48'} />
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

        {/* Próximas tarefas */}
        <Panel title="Próximas tarefas" icon={<CalendarClock size={16} />} className="order-1 xl:order-3">
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
                        {item.alert ? '⚠ Atrasado' : item.meta}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-w-faint transition group-hover:text-w-rose" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBox title="Nenhuma tarefa pendente" text="As próximas tarefas aparecerão aqui." />
          )}
        </Panel>
      </section>

      {/* ── Charts ── */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel title="Financeiro: planejado x realizado" icon={<WalletCards size={16} />} className={!hasFinanceData ? 'hidden sm:block' : ''}>
          {hasFinanceData ? (
            <div className="h-52 sm:h-64">
              <ResponsiveContainer>
                <BarChart data={financeChart} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(v) => formatMoney(Number(v)).replace(',00', '')} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {financeChart.map((_, i) => <Cell key={i} fill={chartColors[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Gráfico indisponível" text="Cadastre valores financeiros para visualizar." />
          )}
        </Panel>

        <Panel title="Convidados por status" icon={<CheckCircle2 size={16} />} className={!guestStatusData.length ? 'hidden sm:block' : ''}>
          {guestStatusData.length ? (
            <div className="h-52 sm:h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={guestStatusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={96} paddingAngle={3} strokeWidth={0}>
                    {guestStatusData.map((_, i) => <Cell key={i} fill={chartColors[i]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #F0EBE6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'inherit', fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Nenhum convidado" text="Adicione convidados para ver a distribuição." />
          )}
        </Panel>
      </section>
    </div>
  );
}
