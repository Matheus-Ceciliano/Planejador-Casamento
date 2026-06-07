import { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'rose' | 'gold' | 'green';
};

const tones = {
  rose:  { bg: 'bg-w-rose-lt',  icon: 'text-w-rose',        dot: 'bg-w-rose'  },
  gold:  { bg: 'bg-w-gold-lt',  icon: 'text-[#D97706]',     dot: 'bg-w-gold'  },
  green: { bg: 'bg-w-green-lt', icon: 'text-[#16A34A]',     dot: 'bg-w-green' },
};

export default function DashboardCard({ title, value, icon: Icon, tone = 'rose' }: Props) {
  const t = tones[tone];
  return (
    <div className="panel panel-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w-faint">{title}</p>
          <p className="mt-2 text-2xl font-bold text-w-text">{value}</p>
        </div>
        <span className={`rounded-2xl p-2.5 ${t.bg} ${t.icon}`}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
}
