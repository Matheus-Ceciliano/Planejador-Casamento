import { ReactNode, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';

type ResponsiveFiltersProps = {
  activeFiltersCount: number;
  children: ReactNode;
  footer?: ReactNode;
  onClearFilters?: () => void;
  summary?: string;
  title?: string;
  clearLabel?: string;
  className?: string;
  gridClassName?: string;
};

export default function ResponsiveFilters({
  activeFiltersCount,
  children,
  footer,
  onClearFilters,
  summary,
  title = 'Filtros',
  clearLabel = 'Limpar filtros',
  className = '',
  gridClassName = ''
}: ResponsiveFiltersProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <section className={`rounded-xl border border-white/60 bg-white/70 shadow-[0_8px_32px_rgba(45,42,38,0.06)] backdrop-blur-[18px] ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[#FAF8F5] sm:px-4"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${hasActiveFilters ? 'bg-[#B76E79] text-white' : 'bg-[#E7E0D8] text-[#6F6760]'}`}>
            <SlidersHorizontal size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#2D2A26]">
              {title}{hasActiveFilters ? ` (${activeFiltersCount})` : ''}
            </span>
            {summary && <span className="mt-0.5 block truncate text-xs text-[#6F6760]">{summary}</span>}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[#6F6760] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${open ? 'grid' : 'hidden'} gap-2 border-t border-white/60 bg-white/45 p-3 sm:p-4 ${gridClassName}`}>
        {children}
        {onClearFilters && (
          <div className="flex items-end">
            <button type="button" className="btn-secondary h-9 w-full border-[#E7E0D8] bg-white px-3 text-sm text-[#2D2A26]" onClick={onClearFilters}>
              <X size={15} /> {clearLabel}
            </button>
          </div>
        )}
      </div>

      {footer && <div className="border-t border-[#E7E0D8] px-3 py-2.5 sm:px-4">{footer}</div>}
    </section>
  );
}
