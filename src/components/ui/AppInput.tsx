import { Eye, EyeOff } from 'lucide-react';
import { InputHTMLAttributes, ReactNode, useId, useState } from 'react';

export type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  required?: boolean;
};

export default function AppInput({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  type,
  id: externalId,
  className,
  disabled,
  required,
  style,
  ...props
}: AppInputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword ? (showPwd ? 'text' : 'password') : type;

  const hasError = Boolean(error);
  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon) || isPassword;

  const inputCls = [
    'field-base',
    hasLeft ? 'pl-[44px]' : '',
    hasRight ? 'pr-[44px]' : '',
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
        {hasLeft && (
          <span className="field-icon-left">{leftIcon}</span>
        )}
        <input
          {...props}
          id={id}
          type={resolvedType}
          disabled={disabled}
          required={required}
          className={inputCls}
          style={style}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [hasError ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((v) => !v)}
            className="field-icon-right cursor-pointer text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
            aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : hasRight ? (
          <span className="field-icon-right">{rightIcon}</span>
        ) : null}
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
