import { Phone } from 'lucide-react';
import { InputHTMLAttributes, useId } from 'react';

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export type AppPhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export default function AppPhoneInput({
  label,
  hint,
  error,
  value,
  onChange,
  id: externalId,
  className,
  disabled,
  required,
  ...props
}: AppPhoneInputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);

  const inputCls = [
    'field-base',
    'pl-[44px]',
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
        <span className="field-icon-left">
          <Phone size={17} />
        </span>
        <input
          {...props}
          id={id}
          type="tel"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          disabled={disabled}
          required={required}
          value={value}
          onChange={(e) => onChange(maskPhone(e.target.value))}
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
