import { X } from 'lucide-react';
import { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({ open, title, children, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-stone-950/35 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-soft sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rosew-100 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-5 sm:py-4">
          <h2 className="min-w-0 text-base font-semibold leading-tight text-ink sm:text-lg">{title}</h2>
          <button className="rounded-lg p-2 text-ink hover:bg-rosew-50" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
