import { TextareaHTMLAttributes, useId } from 'react';

export type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  minRows?: number;
  required?: boolean;
};

export default function AppTextarea({
  label,
  hint,
  error,
  minRows = 3,
  id: externalId,
  className,
  disabled,
  required,
  ...props
}: AppTextareaProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);

  const textareaCls = [
    'field-base',
    'resize-y',
    'py-3',             // vertical padding for textarea
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
      <textarea
        {...props}
        id={id}
        disabled={disabled}
        required={required}
        className={textareaCls}
        style={{ height: 'auto', minHeight: `${minRows * 1.6 + 1.5}rem`, ...(props.style ?? {}) }}
        aria-invalid={hasError || undefined}
        aria-describedby={
          [hasError ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {hint && !hasError && (
        <p id={hintId} className="field-hint">{hint}</p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="field-error-text">{error}</p>
      )}
    </div>
  );
}
