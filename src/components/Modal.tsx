import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { retainModalLayer } from '../utils/modalLayer';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({ open, title, children, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    return retainModalLayer();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-stretch justify-center bg-slate-950/45 p-0 backdrop-blur-[8px] sm:items-center sm:p-4 animate-fade-in">
      <div className="relative z-[9999] flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-w-card shadow-float sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl animate-slide-up">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-w-border bg-w-card px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:py-5">
          <h2 className="min-w-0 text-base font-bold leading-tight text-w-text sm:text-lg">
            {title}
          </h2>
          <button
            className="shrink-0 rounded-xl p-2 text-w-muted transition hover:bg-w-surface hover:text-w-text"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
