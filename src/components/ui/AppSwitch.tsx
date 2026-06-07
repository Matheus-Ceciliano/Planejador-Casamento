import { useId } from 'react';

export type AppSwitchProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function AppSwitch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: AppSwitchProps) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={`block text-sm font-medium ${disabled ? 'cursor-not-allowed text-[#9CA3AF]' : 'cursor-pointer text-[#1F2937]'}`}
        >
          {label}
        </label>
        {hint && (
          <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
          'transition-all duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(225,29,72,0.15)]',
          checked
            ? 'bg-[#E11D48]'
            : 'bg-[#E5E7EB]',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.20)]',
            'transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
