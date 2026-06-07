import { Check } from 'lucide-react';
import { InputHTMLAttributes, useId } from 'react';

export type AppCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hint?: string;
  error?: string;
};

export default function AppCheckbox({
  label,
  hint,
  error,
  id: externalId,
  disabled,
  className,
  ...props
}: AppCheckboxProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hasError = Boolean(error);

  return (
    <div className="flex items-start gap-3">
      <div className="relative mt-0.5 shrink-0">
        <input
          {...props}
          id={id}
          type="checkbox"
          disabled={disabled}
          className={[
            'peer sr-only',
            className ?? '',
          ].join(' ')}
          aria-invalid={hasError || undefined}
        />
        <label
          htmlFor={id}
          className={[
            'flex h-5 w-5 cursor-pointer items-center justify-center rounded-[6px] border-2 transition-all duration-150',
            hasError
              ? 'border-[#EF4444] peer-checked:border-[#EF4444] peer-checked:bg-[#EF4444]'
              : 'border-[#E5E7EB] peer-checked:border-[#E11D48] peer-checked:bg-[#E11D48]',
            'peer-focus-visible:ring-4 peer-focus-visible:ring-[rgba(225,29,72,0.15)]',
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        >
          <Check
            size={13}
            strokeWidth={3}
            className="scale-0 text-white transition-transform peer-checked:scale-100 hidden"
          />
          {/* Checkmark visible via CSS */}
          <svg
            className="hidden h-3 w-3 text-white peer-checked:block"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2,6 5,9 10,3" />
          </svg>
        </label>
      </div>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={`block text-sm font-medium leading-5 ${disabled ? 'cursor-not-allowed text-[#9CA3AF]' : 'cursor-pointer text-[#1F2937]'}`}
        >
          {label}
        </label>
        {hint && !hasError && (
          <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p>
        )}
        {hasError && (
          <p className="mt-0.5 text-xs font-medium text-[#EF4444]">{error}</p>
        )}
      </div>
    </div>
  );
}
