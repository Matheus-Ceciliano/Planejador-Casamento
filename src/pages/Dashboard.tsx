import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ListChecks,
  Users,
  WalletCards
} from 'lucide-react';
import { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Guest, Task, Vendor } from '../types';
import { daysUntil, formatDate, formatMoney } from '../utils/format';
import { getPendingValue, isBudgetOverdue } from '../utils/finance';

const chartColors = ['#D8A7A0', '#D5A65A', '#8FA87A', '#C97C7C'];

function Panel({ title, icon, children, className = '' }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[#F3E3D3] bg-white p-3 shadow-[0_10px_24px_rgba(58,43,39,0.05)] sm:p-4 sm:shadow-[0_14px_32px_rgba(58,43,39,0.06)] ${className}`}>
      <div className="mb-3 flex items-center gap-2 sm:mb-4">
        <span className="rounded-lg bg-[#F3E3D3] p-1.5 text-[#7A6F6B] sm:p-2">{icon}</span>
        <h2 className="text-sm font-semibold text-[#2F2926] sm:text-base">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  title,
  mobileTitle,
  value,
  mobileValue,
  helper,
  mobileHelper,
  icon,
  alert,
  onClick
}: {
  title: string;
  mobileTitle?: string;
  value: string | number;
  mobileValue?: string | number;
  helper: string;
  mobileHelper?: string;
  icon: ReactNode;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-2.5 text-left shadow-[0_8px_18px_rgba(58,43,39,0.05)] transition hover:-translate-y-0.5 hover:border-[#D8A7A0] sm:p-4 sm:shadow-[0_14px_32px_rgba(58,43,39,0.06)] ${
        alert ? 'border-[#C97C7C]/35 ring-1 ring-[#C97C7C]/10' : 'border-[#F3E3D3]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A6F6B] sm:hidden">{mobileTitle ?? title}</p>
          <p className="hidden text-xs font-semibold uppercase tracking-wide text-[#7A6F6B] sm:block">{title}</p>
          <p className={`mt-0.5 text-lg font-semibold sm:mt-2 sm:text-2xl ${alert ? 'text-[#a95757]' : 'text-[#2F2926]'}`}>
            <span className="sm:hidden">{mobileValue ?? value}</span>
            <span className="hidden sm:inline">{value}</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#7A6F6B] sm:hidden">{mobileHelper ?? helper}</p>
          <p className="mt-1 hidden text-sm text-[#7A6F6B] sm:line-clamp-2 sm:block">{helper}</p>
        </div>
        <span className={`rounded-lg p-1.5 sm:p-2 ${alert ? 'bg-[#C97C7C]/15 text-[#a95757]' : 'bg-[#F3E3D3] text-[#7A6F6B]'}`}>{icon}</span>
      </div>
    </button>
  );
}

function ProgressBar({ value, tone = 'bg-[#8FA87A]' }: { value: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#F3E3D3]">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function EmptyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#F3E3D3] bg-[#FFF8F6] p-3 text-sm sm:p-4">
      <p className="font-semibold text-[#2F2926]">{title}</p>
      <p className="mt-1 text-[#7A6F6B]">{text}</p>
    </div>
  );
}

function CompactGuestEmpty({ onClick }: { onClick: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[#F3E3D3] bg-[#FFF8F6] p-3 text-sm">
      <p className="font-semibold text-[#2F2926]">Nenhum convidado adicionado</p>
      <button type="button" className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-[#F3E3D3] bg-white px-3 text-xs font-semibold text-[#3A2B27]" onClick={onClick}>
        Adicionar convidados
      </button>
    </div>
  );
}

function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')}k`;
  return formatMoney(value).replace(',00', '');
}

function isLateTask(task: Task) {
  return Boolean(task.status !== 'concluída' && task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
}

function taskPriorityRank(task: Task) {
  return { alta: 0, média: 1, baixa: 2 }[task.priority] ?? 3;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { wedding } = useWedding();
  const guests = useWeddingTable<Guest>('guests');
  const budget = useWeddingTable<BudgetItem>('budget_items');
  const vendors = useWeddingTable<Vendor>('vendors');
  const tasks = useWeddingTable<Task>('tasks');

  const countPeople = (rows: Guest[]) => rows.reduce((sum, guest) => sum + 1 + Number(guest.companions ?? 0), 0);

  const totalGuests = countPeople(guests.rows);
  const confirmedGuests = countPeople(guests.rows.filter((guest) => guest.invite_status === 'confirmado'));
  const refusedGuests = countPeople(guests.rows.filter((guest) => guest.invite_status === 'recusado'));
  const pendingGuests = countPeople(guests.rows.filter((guest) => !['confirmado', 'recusado'].includes(guest.invite_status)));
  const adults = guests.rows.filter((guest) => guest.guest_type === 'adulto').length;
  const children = guests.rows.filter((guest) => guest.guest_type === 'criança').length;
  const special = guests.rows.filter((guest) => guest.guest_type === 'especial').length;
  const confirmationPercent = totalGuests ? Math.round((confirmedGuests / totalGuests) * 100) : 0;

  const planned = Number(wedding?.planned_budget ?? 0);
  const contracted = budget.rows.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0);
  const paid = budget.rows.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0);
  const pendingValue = Math.max(0, contracted - paid);
  const available = planned - contracted;
  const budgetPercent = planned ? Math.round((contracted / planned) * 100) : 0;
  const overdueItems = budget.rows.filter(isBudgetOverdue);
  const lateTasks = tasks.rows.filter(isLateTask);
  const contractedVendors = vendors.rows.filter((vendor) => vendor.status === 'contratado').length;

  const coupleName = [wedding?.bride_name, wedding?.groom_name].filter(Boolean).join(' & ') || wedding?.name || 'Dashboard';
  const compactCoupleName = [wedding?.bride_name, wedding?.groom_name]
    .filter(Boolean)
    .map((name) => String(name).trim().split(/\s+/)[0])
    .join(' & ') || coupleName;
  const remainingDays = wedding?.wedding_date ? daysUntil(wedding.wedding_date) : null;

  const financeChart = [
    { name: 'Planejado', value: planned },
    { name: 'Contratado', value: contracted },
    { name: 'Pago', value: paid },
    { name: 'Pendente', value: pendingValue }
  ];
  const hasFinanceData = financeChart.some((item) => item.value > 0);

  const guestStatusData = [
    { name: 'Confirmados', value: confirmedGuests },
    { name: 'Pendentes', value: pendingGuests },
    { name: 'Recusados', value: refusedGuests }
  ].filter((item) => item.value > 0);

  const upcomingItems = useMemo(() => {
    const taskItems = tasks.rows
      .filter((task) => task.status !== 'concluída')
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        meta: task.due_date ? `Tarefa • ${formatDate(task.due_date)}` : 'Tarefa pendente',
        date: task.due_date ?? '9999-12-31',
        alert: isLateTask(task),
        rank: taskPriorityRank(task)
      }));

    const paymentItems = budget.rows
      .filter((item) => getPendingValue(item.contracted_value, item.paid_value) > 0)
      .map((item) => ({
        id: `payment-${item.id}`,
        title: item.name,
        meta: item.due_date ? `Pagamento • ${formatDate(item.due_date)}` : 'Pagamento sem vencimento',
        date: item.due_date ?? '9999-12-31',
        alert: isBudgetOverdue(item),
        rank: 2
      }));

    return [...taskItems, ...paymentItems]
      .sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank)
      .slice(0, 5);
  }, [budget.rows, tasks.rows]);

  return (
    <div className="min-h-screen space-y-3 bg-[#FFF8F6] text-[#2F2926] sm:space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#2F2926] sm:hidden">{compactCoupleName}</h1>
          <h1 className="hidden text-3xl font-semibold text-[#2F2926] sm:block">{coupleName}</h1>
          <p className="mt-0.5 text-sm text-[#7A6F6B] sm:mt-1">
            Resumo do casamento {remainingDays !== null ? `• ${remainingDays} dias restantes` : '• Data não definida'}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F3E3D3] px-2.5 py-1 text-xs font-semibold text-[#8a5a12] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm">
          <Clock3 size={14} /> Planejamento em andamento
        </span>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title="Convidados"
          value={totalGuests}
          mobileValue={totalGuests}
          helper={`${confirmedGuests} confirmados • ${pendingGuests} pendentes`}
          mobileHelper={`${confirmedGuests} confirmados`}
          icon={<Users size={19} />}
          onClick={() => navigate('/convidados')}
        />
        <KpiCard
          title="Financeiro"
          mobileTitle="Financeiro"
          value={formatMoney(planned)}
          mobileValue={compactMoney(planned)}
          helper={`${formatMoney(contracted)} contratado (${budgetPercent}%)`}
          mobileHelper={`${budgetPercent}% usado`}
          icon={<WalletCards size={19} />}
          alert={planned > 0 && contracted > planned}
          onClick={() => navigate('/orcamento')}
        />
        <KpiCard
          title="Pagamentos vencidos"
          mobileTitle="Vencidos"
          value={overdueItems.length}
          mobileValue={overdueItems.length}
          helper={overdueItems.length ? `${formatMoney(overdueItems.reduce((sum, item) => sum + getPendingValue(item.contracted_value, item.paid_value), 0))} em atraso` : 'Nenhum em atraso'}
          mobileHelper={overdueItems.length ? `${overdueItems.length} em atraso` : 'Nenhum atraso'}
          icon={<AlertTriangle size={19} />}
          alert={overdueItems.length > 0}
          onClick={() => navigate('/orcamento/vencimentos?filter=overdue')}
        />
        <KpiCard
          title="Tarefas atrasadas"
          mobileTitle="Tarefas"
          value={lateTasks.length}
          mobileValue={lateTasks.length}
          helper={lateTasks.length ? 'Abrir tarefas vencidas' : `${contractedVendors} fornecedores contratados`}
          mobileHelper={`${lateTasks.length} atrasadas`}
          icon={<ListChecks size={19} />}
          alert={lateTasks.length > 0}
          onClick={() => navigate('/tarefas?filter=late')}
        />
      </section>

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Convidados" icon={<Users size={17} />} className="order-3 xl:order-1">
          {totalGuests ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#8FA87A]/12 p-2 sm:p-3">
                  <p className="text-xs text-[#5f7f4d]">Confirmados</p>
                  <p className="mt-0.5 text-lg font-semibold text-[#5f7f4d] sm:mt-1 sm:text-xl">{confirmedGuests}</p>
                </div>
                <div className="rounded-lg bg-[#F3E3D3] p-2 sm:p-3">
                  <p className="text-xs text-[#7A6F6B]">Pendentes</p>
                  <p className="mt-0.5 text-lg font-semibold text-[#8a5a12] sm:mt-1 sm:text-xl">{pendingGuests}</p>
                </div>
                <div className="rounded-lg bg-[#C97C7C]/12 p-2 sm:p-3">
                  <p className="text-xs text-[#a95757]">Recusados</p>
                  <p className="mt-0.5 text-lg font-semibold text-[#a95757] sm:mt-1 sm:text-xl">{refusedGuests}</p>
                </div>
              </div>
              <div className="grid gap-1.5 text-sm text-[#7A6F6B] sm:gap-2">
                <div className="flex justify-between"><span>Total</span><strong className="text-[#2F2926]">{totalGuests}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Adultos</span><strong className="text-[#2F2926]">{adults}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Crianças</span><strong className="text-[#2F2926]">{children}</strong></div>
                <div className="hidden justify-between sm:flex"><span>Especiais</span><strong className="text-[#2F2926]">{special}</strong></div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm text-[#7A6F6B] sm:mb-2">
                  <span>Confirmação</span>
                  <strong className="text-[#2F2926]">{confirmationPercent}%</strong>
                </div>
                <ProgressBar value={confirmationPercent} />
              </div>
            </div>
          ) : (
            <>
              <div className="sm:hidden"><CompactGuestEmpty onClick={() => navigate('/convidados')} /></div>
              <div className="hidden sm:block"><EmptyBox title="Nenhum convidado adicionado" text="Adicione convidados para acompanhar confirmações." /></div>
            </>
          )}
        </Panel>

        <Panel title="Financeiro" icon={<CircleDollarSign size={17} />} className="order-2 xl:order-2">
          {hasFinanceData ? (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-sm text-[#7A6F6B] sm:mb-2">
                  <span>Orçamento usado</span>
                  <strong className={budgetPercent > 100 ? 'text-[#a95757]' : 'text-[#2F2926]'}>{budgetPercent}%</strong>
                </div>
                <ProgressBar value={budgetPercent} tone={budgetPercent > 100 ? 'bg-[#C97C7C]' : 'bg-[#D8A7A0]'} />
              </div>
              <div className="grid gap-1.5 text-sm text-[#7A6F6B] sm:gap-2">
                <div className="flex justify-between"><span>Planejado</span><strong className="text-[#2F2926]">{formatMoney(planned)}</strong></div>
                <div className="flex justify-between"><span>Contratado</span><strong className="text-[#2F2926]">{formatMoney(contracted)}</strong></div>
                <div className="flex justify-between"><span>Pago</span><strong className="text-[#5f7f4d]">{formatMoney(paid)}</strong></div>
                <div className="flex justify-between"><span>Pendente</span><strong className="text-[#8a5a12]">{formatMoney(pendingValue)}</strong></div>
                <div className="border-t border-[#F3E3D3] pt-2 flex justify-between"><span>Saldo disponível</span><strong className={available < 0 ? 'text-[#a95757]' : 'text-[#2F2926]'}>{formatMoney(available)}</strong></div>
              </div>
            </div>
          ) : (
            <EmptyBox title="Nenhum dado financeiro" text="Adicione gastos ou fornecedores para acompanhar o orçamento." />
          )}
        </Panel>

        <Panel title="Próximas tarefas" icon={<CalendarClock size={17} />} className="order-1 xl:order-3">
          {upcomingItems.length ? (
            <div className="space-y-2">
              {upcomingItems.map((item) => (
                <div key={item.id} className={`rounded-lg border bg-[#FFF8F6] p-2.5 sm:p-3 ${item.alert ? 'border-[#C97C7C]/35' : 'border-[#F3E3D3]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold text-[#2F2926] sm:text-base">{item.title}</p>
                      <p className={`mt-0.5 text-xs sm:mt-1 sm:text-sm ${item.alert ? 'text-[#a95757]' : 'text-[#7A6F6B]'}`}>{item.alert ? 'Atrasado' : item.meta}</p>
                    </div>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-[#D8A7A0]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBox title="Nenhuma tarefa pendente" text="As próximas tarefas aparecerão aqui." />
          )}
        </Panel>
      </section>

      <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel title="Financeiro: planejado x realizado" icon={<WalletCards size={17} />} className={!hasFinanceData ? 'hidden sm:block' : ''}>
          {hasFinanceData ? (
            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <BarChart data={financeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3E3D3" />
                  <XAxis dataKey="name" tick={{ fill: '#7A6F6B', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#7A6F6B', fontSize: 12 }} tickFormatter={(value) => formatMoney(Number(value)).replace(',00', '')} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {financeChart.map((_, index) => <Cell key={index} fill={chartColors[index]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Gráfico indisponível" text="Cadastre valores financeiros para visualizar a comparação." />
          )}
        </Panel>

        <Panel title="Convidados por status" icon={<CheckCircle2 size={17} />} className={!guestStatusData.length ? 'hidden sm:block' : ''}>
          {guestStatusData.length ? (
            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={guestStatusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92} paddingAngle={3}>
                    {guestStatusData.map((_, index) => <Cell key={index} fill={chartColors[index]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBox title="Nenhum convidado adicionado" text="Adicione convidados para acompanhar confirmações por status." />
          )}
        </Panel>
      </section>
    </div>
  );
}
