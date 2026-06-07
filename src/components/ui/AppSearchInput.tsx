import { Search, X } from 'lucide-react';
import { InputHTMLAttributes, useId } from 'react';

export type AppSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  hint?: string;
  onClear?: () => void;
};

export default function AppSearchInput({
  label,
  hint,
  value,
  onClear,
  id: externalId,
  className,
  disabled,
  onChange,
  ...props
}: AppSearchInputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hasValue = Boolean(value && String(value).length > 0);

  const inputCls = [
    'field-base',
    'pl-[44px]',
    hasValue && onClear ? 'pr-[44px]' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className="block w-full">
      {label && (
        <label htmlFor={id} className="field-label">{label}</label>
      )}
      <div className="relative">
        <span className="field-icon-left">
          <Search size={17} />
        </span>
        <input
          {...props}
          id={id}
          type="search"
          value={value}
          disabled={disabled}
          onChange={onChange}
          className={inputCls}
          // suppress native search cancel button
          style={{ WebkitAppearance: 'none' }}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="field-icon-right cursor-pointer text-[#9CA3AF] transition-colors hover:text-[#1F2937]"
            aria-label="Limpar busca"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
