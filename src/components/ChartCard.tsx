import { ReactNode } from 'react';

export default function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel p-4">
      <h3 className="mb-4 text-sm font-semibold text-event-text">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}
