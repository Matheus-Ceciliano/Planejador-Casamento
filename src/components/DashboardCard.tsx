import { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'rose' | 'gold' | 'olive';
};

const tones = {
  rose: 'bg-rosew-100 text-rosew-500',
  gold: 'bg-champagne text-goldsoft',
  olive: 'bg-olivew/15 text-olivew'
};

export default function DashboardCard({ title, value, icon: Icon, tone = 'rose' }: Props) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
}
