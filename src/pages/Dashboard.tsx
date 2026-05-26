import { CalendarDays, CheckCircle2, CircleDollarSign, Clock, Handshake, Table2, Users, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from '../components/ChartCard';
import DashboardCard from '../components/DashboardCard';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Guest, Task, Vendor, WeddingTable } from '../types';
import { daysUntil, formatMoney } from '../utils/format';

const colors = ['#bd746d', '#c8a86a', '#9faa83', '#6d655e', '#edbdb5'];

export default function Dashboard() {
  const { wedding } = useWedding();
  const guests = useWeddingTable<Guest>('guests');
  const budget = useWeddingTable<BudgetItem>('budget_items');
  const vendors = useWeddingTable<Vendor>('vendors');
  const tables = useWeddingTable<WeddingTable>('tables');
  const tasks = useWeddingTable<Task>('tasks');

  const totalGuests = guests.rows.reduce((sum, guest) => sum + 1 + Number(guest.companions ?? 0), 0);
  const confirmed = guests.rows.filter((guest) => guest.invite_status === 'confirmado').length;
  const pending = guests.rows.filter((guest) => !['confirmado', 'recusado'].includes(guest.invite_status)).length;
  const adults = guests.rows.filter((guest) => guest.guest_type === 'adulto').length;
  const children = guests.rows.filter((guest) => guest.guest_type === 'criança').length;
  const special = guests.rows.filter((guest) => guest.guest_type === 'especial').length;
  const contracted = budget.rows.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0);
  const paid = budget.rows.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0);
  const overdue = budget.rows.filter((item) => item.due_date && item.payment_status !== 'pago' && new Date(item.due_date) < new Date()).length;
  const lateTasks = tasks.rows.filter((task) => task.status !== 'concluída' && task.due_date && new Date(task.due_date) < new Date()).length;

  const byCategory = Object.values(
    budget.rows.reduce<Record<string, { name: string; value: number }>>((acc, item) => {
      acc[item.category] ??= { name: item.category, value: 0 };
      acc[item.category].value += Number(item.contracted_value ?? 0);
      return acc;
    }, {})
  );

  const paymentData = [
    { name: 'Pago', value: paid },
    { name: 'Pendente', value: Math.max(0, contracted - paid) }
  ];

  const guestStatus = ['confirmado', 'pendente', 'recusado'].map((status) => ({
    name: status,
    value: guests.rows.filter((guest) => guest.invite_status === status).length
  }));

  const realVsPlanned = [
    { name: 'Planejado', value: Number(wedding?.planned_budget ?? 0) },
    { name: 'Contratado', value: contracted },
    { name: 'Pago', value: paid }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Resumo financeiro, convidados e pendências do casamento.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Dias restantes" value={daysUntil(wedding?.wedding_date)} icon={CalendarDays} tone="rose" />
        <DashboardCard title="Total de convidados" value={totalGuests} icon={Users} tone="gold" />
        <DashboardCard title="Confirmados" value={confirmed} icon={CheckCircle2} tone="olive" />
        <DashboardCard title="Pendentes" value={pending} icon={Clock} tone="gold" />
        <DashboardCard title="Adultos" value={adults} icon={Users} tone="rose" />
        <DashboardCard title="Crianças" value={children} icon={Users} tone="gold" />
        <DashboardCard title="Especiais" value={special} icon={Users} tone="olive" />
        <DashboardCard title="Orçamento planejado" value={formatMoney(wedding?.planned_budget)} icon={WalletCards} tone="gold" />
        <DashboardCard title="Total contratado" value={formatMoney(contracted)} icon={CircleDollarSign} tone="rose" />
        <DashboardCard title="Total pago" value={formatMoney(paid)} icon={CircleDollarSign} tone="olive" />
        <DashboardCard title="Pagamentos vencidos" value={overdue} icon={Clock} tone="rose" />
        <DashboardCard title="Tarefas atrasadas" value={lateTasks} icon={Clock} tone="rose" />
        <DashboardCard title="Fornecedores contratados" value={vendors.rows.filter((vendor) => vendor.status === 'contratado').length} icon={Handshake} tone="olive" />
        <DashboardCard title="Mesas preenchidas" value={tables.rows.length} icon={Table2} tone="gold" />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Gastos por categoria">
          <ResponsiveContainer>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="value" fill="#bd746d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pagamentos pagos x pendentes">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" outerRadius={95} label>
                {paymentData.map((_, index) => <Cell key={index} fill={colors[index]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Convidados por status">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={guestStatus} dataKey="value" nameKey="name" outerRadius={95} label>
                {guestStatus.map((_, index) => <Cell key={index} fill={colors[index]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gastos planejados x reais">
          <ResponsiveContainer>
            <BarChart data={realVsPlanned}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="value" fill="#9faa83" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}
