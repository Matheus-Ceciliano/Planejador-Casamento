import { ReactNode, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

type ResponsiveFiltersProps = {
  activeFiltersCount: number;
  children: ReactNode;
  footer?: ReactNode;
  onClearFilters?: () => void;
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
  title = 'Filtros',
  clearLabel = 'Limpar filtros',
  className = '',
  gridClassName = ''
}: ResponsiveFiltersProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <section className={`rounded-lg border border-[#F3E3D3] bg-white p-3 shadow-[0_14px_30px_rgba(58,43,39,0.05)] sm:p-4 md:shadow-[0_8px_20px_rgba(58,43,39,0.04)] ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        className={`mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition md:hidden ${
          hasActiveFilters
            ? 'border-[#3A2B27] bg-[#3A2B27] text-white'
            : 'border-[#F3E3D3] bg-[#FFF8F6] text-[#3A2B27] hover:bg-[#F3E3D3]/45'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={16} />
        {title}{hasActiveFilters ? ` (${activeFiltersCount})` : ''}
      </button>

      <div className={`${open ? 'grid' : 'hidden'} gap-2 rounded-lg border border-[#F3E3D3] bg-[#FFF8F6] p-3 md:grid md:border-0 md:bg-transparent md:p-0 ${gridClassName}`}>
        {children}
        {onClearFilters && (
          <div className="flex items-end">
            <button type="button" className="btn-secondary h-9 w-full border-[#F3E3D3] bg-white px-3 text-sm text-[#3A2B27]" onClick={onClearFilters}>
              <X size={15} /> {clearLabel}
            </button>
          </div>
        )}
      </div>

      {footer}
    </section>
  );
}
