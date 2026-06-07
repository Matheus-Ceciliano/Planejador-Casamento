import { Calendar } from 'lucide-react';
import { InputHTMLAttributes, useId } from 'react';

export type AppDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export default function AppDateInput({
  label,
  hint,
  error,
  id: externalId,
  className,
  disabled,
  required,
  ...props
}: AppDateInputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);

  const inputCls = [
    'field-base',
    'pl-[44px]',
    'cursor-pointer',
    hasError ? 'is-error' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`block w-full ${hasError ? 'field-error' : ''}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-[#E11D48]" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        <span className="field-icon-left pointer-events-none">
          <Calendar size={17} />
        </span>
        <input
          {...props}
          id={id}
          type="date"
          disabled={disabled}
          required={required}
          className={inputCls}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [hasError ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
      </div>
      {hint && !hasError && (
        <p id={hintId} className="field-hint">{hint}</p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="field-error-text">{error}</p>
      )}
    </div>
  );
}
