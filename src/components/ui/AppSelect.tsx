import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { ReactNode, useId, useState } from 'react';

const SEARCH_THRESHOLD = 8;
const EMPTY_OPTION_VALUE = '__app_select_empty__';

export type AppSelectOption = { label: string; value: string };

export type AppSelectProps = {
  label?: string;
  hint?: string;
  error?: string;
  options: AppSelectOption[];
  placeholder?: string;
  leftIcon?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Controlled value. Use empty string '' for "no selection". */
  value?: string;
  /** Called when the user selects an option. */
  onValueChange?: (value: string) => void;
  id?: string;
  name?: string;
  className?: string;
};

export default function AppSelect({
  label,
  hint,
  error,
  options,
  placeholder = 'Selecionar...',
  leftIcon,
  required,
  disabled,
  value,
  onValueChange,
  id: externalId,
  name,
  className,
}: AppSelectProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);
  const hasLeft = Boolean(leftIcon);
  const showSearch = options.length > SEARCH_THRESHOLD;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filteredOptions = showSearch && search.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Radix needs value to be undefined (not '') to show placeholder
  const radixValue = value === '' ? undefined : value;

  const triggerCls = [
    'field-base radix-select-trigger',
    'relative flex h-12 w-full min-w-0 cursor-pointer select-none items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-2xl text-left',
    hasLeft ? 'pl-[44px]' : '',
    // right padding for chevron
    'pr-[44px]',
    hasError ? 'is-error' : '',
    !value ? 'text-[#9CA3AF]' : 'text-[#1F2937]',
    // focus ring via data-state attribute on the field-base:focus selector
  ].filter(Boolean).join(' ');

  return (
    <div className={`block w-full min-w-0 ${className ?? ''} ${hasError ? 'field-error' : ''}`}>
      {label && (
        <p className="field-label" id={`${id}-label`}>
          {label}
          {required && (
            <span className="ml-0.5 text-[#E11D48]" aria-hidden>*</span>
          )}
        </p>
      )}

      <Select.Root
        value={radixValue}
        onValueChange={(nextValue) => onValueChange?.(nextValue === EMPTY_OPTION_VALUE ? '' : nextValue)}
        disabled={disabled}
        name={name}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch('');
        }}
      >
        <div className="relative">
          {hasLeft && (
            <span className="field-icon-left pointer-events-none z-10">
              {leftIcon}
            </span>
          )}

          <Select.Trigger
            id={id}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-invalid={hasError || undefined}
            aria-required={required}
            aria-describedby={
              [hasError ? errorId : null, hint ? hintId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={triggerCls}
          >
            <Select.Value placeholder={placeholder} className="block min-w-0 flex-1 truncate whitespace-nowrap" />
            <Select.Icon asChild>
              <ChevronDown
                size={17}
                strokeWidth={2.5}
                className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 shrink-0 text-[#9CA3AF] transition-transform duration-200 ease-out ${open ? 'rotate-180' : 'rotate-0'}`}
              />
            </Select.Icon>
          </Select.Trigger>
        </div>

        <Select.Portal>
          <Select.Content
            className="radix-select-content z-[10000] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.10),0_2px_8px_rgba(15,23,42,0.06)]"
            position="popper"
            sideOffset={6}
            align="start"
            avoidCollisions
          >
            {/* Search box — shown when many options */}
            {showSearch && (
              <div
                className="border-b border-[#F3F4F6] px-2.5 py-2.5"
                /* Prevent Radix keyboard capture inside the search input */
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    autoFocus
                    className="h-9 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#E11D48] focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Scroll up button */}
            <Select.ScrollUpButton className="flex cursor-default items-center justify-center py-1.5 text-[#9CA3AF]">
              <ChevronUp size={14} />
            </Select.ScrollUpButton>

            <Select.Viewport className="max-h-[264px] p-1.5">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, index) => (
                  <Select.Item
                    key={`${opt.value || EMPTY_OPTION_VALUE}-${index}`}
                    value={opt.value === '' ? EMPTY_OPTION_VALUE : opt.value}
                    className="radix-select-item group relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#1F2937] outline-none transition-colors hover:bg-[#FFF1F5] hover:text-[#E11D48] data-[disabled]:cursor-not-allowed data-[highlighted]:bg-[#FFF1F5] data-[highlighted]:text-[#E11D48] data-[state=checked]:bg-[#FFF1F5] data-[state=checked]:font-semibold data-[state=checked]:text-[#BE123C]"
                  >
                    <Select.ItemText className="min-w-0 flex-1">
                      <span className="block min-w-0 truncate whitespace-nowrap">
                        {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
                      </span>
                    </Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check size={15} strokeWidth={2.5} className="text-[#E11D48]" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))
              ) : (
                <div className="px-4 py-3 text-center text-sm text-[#9CA3AF]">
                  Nenhum resultado encontrado
                </div>
              )}
            </Select.Viewport>

            {/* Scroll down button */}
            <Select.ScrollDownButton className="flex cursor-default items-center justify-center py-1.5 text-[#9CA3AF]">
              <ChevronDown size={14} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {hint && !hasError && (
        <p id={hintId} className="field-hint">{hint}</p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="field-error-text">{error}</p>
      )}
    </div>
  );
}
