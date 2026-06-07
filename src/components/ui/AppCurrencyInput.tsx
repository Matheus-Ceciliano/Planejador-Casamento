import { InputHTMLAttributes, useId } from 'react';
import { moneyInput, parseMoney } from '../../utils/format';

export type AppCurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  label?: string;
  hint?: string;
  error?: string;
  value: number;
  onValueChange: (value: number) => void;
  required?: boolean;
};

export default function AppCurrencyInput({
  label,
  hint,
  error,
  value,
  onValueChange,
  id: externalId,
  className,
  disabled,
  required,
  ...props
}: AppCurrencyInputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);

  const inputCls = [
    'field-base',
    'pl-[52px]',        // room for "R$" prefix
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
        <span className="field-prefix select-none">R$</span>
        <input
          {...props}
          id={id}
          inputMode="numeric"
          disabled={disabled}
          required={required}
          value={moneyInput(value)}
          onChange={(e) => onValueChange(parseMoney(e.target.value))}
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
