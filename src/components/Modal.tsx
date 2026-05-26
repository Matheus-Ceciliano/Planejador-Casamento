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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-4">
      <div className="max-h-[96vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-soft sm:max-h-[92vh] sm:max-w-3xl sm:rounded-lg">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-rosew-100 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 text-base font-semibold text-ink sm:text-lg">{title}</h2>
          <button className="rounded-lg p-2 hover:bg-rosew-50" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
