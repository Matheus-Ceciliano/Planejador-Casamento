import { LucideIcon } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center p-10 text-center">
      <span className="rounded-lg bg-rosew-100 p-3 text-rosew-500">
        <Icon size={24} />
      </span>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-stone-500">{text}</p>
    </div>
  );
}
