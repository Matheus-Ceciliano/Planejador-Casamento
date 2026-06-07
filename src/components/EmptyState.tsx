import { LucideIcon } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center p-10 text-center">
      <span className="rounded-2xl bg-w-rose-lt p-3 text-w-rose">
        <Icon size={24} />
      </span>
      <h3 className="mt-3 font-bold text-w-text">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-w-muted">{text}</p>
    </div>
  );
}
