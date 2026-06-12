import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
};

export default function ActionButton({
  loading = false,
  loadingText,
  disabled,
  children,
  className = '',
  type = 'button',
  onClick,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`relative ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={(event) => {
        if (loading || disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className={`inline-flex items-center justify-center gap-2 ${loading ? 'invisible' : ''}`}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2 px-[inherit]">
          <Loader2 size={16} className="shrink-0 animate-spin" />
          <span>{loadingText ?? children}</span>
        </span>
      )}
    </button>
  );
}
