import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, Trash2 } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { retainModalLayer } from '../utils/modalLayer';

export type ConfirmDialogVariant = 'success' | 'warning' | 'danger' | 'info';

type Detail = {
  label: string;
  value: ReactNode;
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  details?: Detail[];
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

const variantConfig = {
  success: {
    Icon: CheckCircle2,
    icon: 'bg-[#F0FDF4] text-[#16A34A] ring-[#BBF7D0]',
    button: 'bg-[#16A34A] hover:bg-[#15803D] focus:ring-[#16A34A]/25'
  },
  warning: {
    Icon: AlertTriangle,
    icon: 'bg-[#FFFBEB] text-[#D97706] ring-[#FDE68A]',
    button: 'bg-[#D97706] hover:bg-[#B45309] focus:ring-[#D97706]/25'
  },
  danger: {
    Icon: Trash2,
    icon: 'bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]',
    button: 'bg-[#DC2626] hover:bg-[#B91C1C] focus:ring-[#DC2626]/25'
  },
  info: {
    Icon: Info,
    icon: 'bg-w-rose-lt text-w-rose ring-w-rose-md',
    button: 'bg-w-rose hover:bg-[#BE123C] focus:ring-w-rose/25'
  }
};

function defaultLoadingLabel(confirmLabel: string) {
  const label = confirmLabel.toLocaleLowerCase('pt-BR');
  if (label.includes('excluir') || label.includes('remover')) return 'Excluindo...';
  if (label.includes('cancelar') || label.includes('recusar')) return 'Cancelando...';
  if (label.includes('contratar')) return 'Contratando...';
  if (label.includes('confirmar')) return 'Confirmando...';
  if (label.includes('alterar') || label.includes('atualizar')) return 'Atualizando...';
  if (label.includes('sair')) return 'Saindo...';
  return 'Processando...';
}

export default function ConfirmDialog({
  open,
  title = 'Confirmar ação?',
  description,
  message,
  confirmLabel = 'Confirmar',
  loadingLabel,
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  details,
  children,
  onCancel,
  onConfirm
}: Props) {
  const runningRef = useRef(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const effectiveLoading = loading || internalLoading;

  async function handleConfirm() {
    if (runningRef.current || effectiveLoading) return;

    runningRef.current = true;
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      runningRef.current = false;
      setInternalLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    const releaseLayer = retainModalLayer();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !effectiveLoading) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      releaseLayer();
    };
  }, [effectiveLoading, onCancel, open]);

  if (!open) return null;

  const config = variantConfig[variant] ?? variantConfig.info;
  const Icon = config.Icon ?? HelpCircle;
  const text = description ?? message ?? '';

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[8px] animate-fade-in"
      onMouseDown={() => {
        if (!effectiveLoading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-float animate-scale-in sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${config.icon}`}>
            <Icon size={24} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-bold leading-6 text-stone-900">
              {title}
            </h2>
            {text && <p className="mt-1 text-sm leading-6 text-stone-600">{text}</p>}
          </div>
        </div>

        {details?.length ? (
          <div className="mt-5 space-y-2.5 rounded-2xl border border-stone-100 bg-stone-50 p-4">
            {details.map((detail) => (
              <div key={detail.label} className="grid grid-cols-[104px_1fr] gap-3 text-sm">
                <span className="font-semibold text-stone-500">{detail.label}</span>
                <span className="min-w-0 break-words font-medium text-stone-800">{detail.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {children}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onCancel} disabled={effectiveLoading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold leading-5 text-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto ${config.button}`}
            onClick={handleConfirm}
            disabled={effectiveLoading}
            aria-busy={effectiveLoading}
          >
            {effectiveLoading && <Loader2 size={16} className="animate-spin" />}
            {effectiveLoading ? loadingLabel ?? defaultLoadingLabel(confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
