import { ArrowLeft, BarChart3, HeartPulse, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetItem, Vendor } from '../types';
import { calculateFinancialHealth, getPendingValue, toPrimaryCategory } from '../utils/finance';
import { formatDate, formatMoney } from '../utils/format';

const chartColors = ['#E11D48', '#2563EB', '#22C55E', '#F59E0B', '#7C3AED', '#0F766E', '#EF4444', '#52525B'];
const healthToneClasses = {
  saudavel: 'text-[#22C55E]',
  atencao: 'text-[#F59E0B]',
  preocupante: 'text-[#F97316]',
  critica: 'text-[#EF4444]',
  sem_dados: 'text-w-muted'
};

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.round((value / total) * 100));
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-w-text">{title}</h2>
      <div className="mt-4 h-64 min-w-0">{children}</div>
    </section>
  );
}

export default function BudgetAnalysis() {
  const navigate = useNavigate();
  const { wedding } = useWedding();
  const items = useWeddingTable<BudgetItem>('budget_items', 'due_date');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');

  const planned = Number(wedding?.planned_budget ?? 0);
  const committed = items.rows.reduce((sum, item) => sum + Number(item.contracted_value ?? 0), 0);
  const paid = items.rows.reduce((sum, item) => sum + Number(item.paid_value ?? 0), 0);
  const pending = Math.max(0, committed - paid);
  const remaining = Math.max(0, planned - committed);
  const committedPct = percent(committed, planned);

  const categoryData = Object.entries(items.rows.reduce<Record<string, number>>((acc, item) => {
    const key = toPrimaryCategory(item.category);
    acc[key] = (acc[key] ?? 0) + Number(item.contracted_value ?? 0);
    return acc;
  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const plannedPaidData = [
    { name: 'Planejado', value: planned },
    { name: 'Comprometido', value: committed },
    { name: 'Pago', value: paid }
  ];

  const evolutionData = Object.entries(items.rows.reduce<Record<string, number>>((acc, item) => {
    const key = item.due_date ? item.due_date.slice(0, 7) : 'Sem data';
    acc[key] = (acc[key] ?? 0) + Number(item.contracted_value ?? 0);
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));

  const nextDue = items.rows
    .filter((item) => item.due_date && getPendingValue(item.contracted_value, item.paid_value) > 0)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
  const expensiveCategory = categoryData[0];
  const health = calculateFinancialHealth({
    orcamentoPlanejado: planned,
    totalContratado: committed,
    totalPago: paid,
    itensFinanceiros: items.rows,
    pagamentos: [],
    fornecedores: vendors.rows,
    dataCasamento: wedding?.wedding_date
  });
  const healthTone = healthToneClasses[health.status];

  return (
    <div className="space-y-5 text-w-text">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-w-faint">Central financeira</p>
          <h1 className="page-title mt-1">Analise Financeira</h1>
          <p className="mt-1 text-sm text-w-muted">Entenda a evolucao dos gastos do casamento.</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/orcamento')}><ArrowLeft size={16} /> Voltar</button>
      </div>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={17} className="text-w-rose" />
            <h2 className="text-sm font-bold">Insights automaticos</h2>
          </div>
          <div className="grid gap-2 text-sm text-w-muted sm:grid-cols-2">
            <p>Voce comprometeu <strong className="text-w-text">{committedPct}%</strong> do orcamento.</p>
            <p>Ainda restam <strong className="text-w-text">{formatMoney(remaining)}</strong> disponiveis.</p>
            <p>Proximo vencimento: <strong className="text-w-text">{nextDue ? `${nextDue.name} em ${formatDate(nextDue.due_date)}` : 'nenhum'}</strong>.</p>
            <p>Categoria mais cara: <strong className="text-w-text">{expensiveCategory ? expensiveCategory.name : 'sem dados'}</strong>.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <HeartPulse size={17} className={healthTone} />
            <h2 className="text-sm font-bold">Saúde financeira</h2>
          </div>
          <p className={`mt-4 text-3xl font-bold ${healthTone}`}>{health.label}</p>
          <p className="mt-1 text-sm font-semibold text-w-text">Score {health.score}</p>
          <p className="mt-1 text-sm font-semibold text-w-muted">Risco financeiro: {health.riscoLabel} ({health.risco}%)</p>
          <p className="mt-2 text-sm text-w-muted">{health.motivo}</p>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <ChartPanel title="Planejado x Pago">
          <ResponsiveContainer>
            <BarChart data={plannedPaidData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={96} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number) => formatMoney(value)} />
              <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#E11D48" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Gastos por Categoria">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                {categoryData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => formatMoney(value)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Evolucao dos Gastos">
          <ResponsiveContainer>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => formatMoney(value)} />
              <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={17} className="text-w-rose" />
          <h2 className="text-sm font-bold">Ranking de categorias</h2>
        </div>
        <div className="grid gap-3">
          {categoryData.map((item) => (
            <div key={item.name} className="grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-center">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div className="h-full rounded-full bg-[#E11D48]" style={{ width: `${percent(item.value, committed)}%` }} />
              </div>
              <p className="text-sm font-bold">{formatMoney(item.value)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
