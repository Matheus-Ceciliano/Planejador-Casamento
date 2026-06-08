import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type AnimatedPageProps = {
  children: ReactNode;
  className?: string;
};

type AnimatedCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

type AnimatedNumberProps = {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
};

type AnimatedProgressBarProps = {
  value: number;
  color?: string;
  className?: string;
  trackClassName?: string;
  duration?: number;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  return <div className={`animate-page-enter ${className}`}>{children}</div>;
}

export function AnimatedCard({ children, className = '', delay = 0 }: AnimatedCardProps) {
  return (
    <div className={`animate-card-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function AnimatedNumber({ value, format, duration = 700, className = '' }: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const previousValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const startValue = previousValue.current;
    const diff = value - startValue;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
        setDisplayValue(value);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reducedMotion, value]);

  const text = useMemo(() => (format ? format(displayValue) : String(Math.round(displayValue))), [displayValue, format]);
  return <span className={className}>{text}</span>;
}

export function AnimatedProgressBar({
  value,
  color = '#E11D48',
  className = '',
  trackClassName = '',
  duration = 700
}: AnimatedProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(reducedMotion ? value : 0);
  const safeValue = Math.min(100, Math.max(0, value));

  useEffect(() => {
    if (reducedMotion) {
      setWidth(safeValue);
      return;
    }

    setWidth(0);
    const frame = requestAnimationFrame(() => setWidth(safeValue));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, safeValue]);

  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-w-border ${trackClassName}`}>
      <div
        className={`h-full rounded-full ${className}`}
        style={{
          width: `${width}%`,
          background: color,
          transition: reducedMotion ? 'none' : `width ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
        }}
      />
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-w-border bg-white p-4 shadow-soft ${className}`}>
      <div className="skeleton-shimmer h-4 w-2/5 rounded-full" />
      <div className="skeleton-shimmer mt-4 h-8 w-3/5 rounded-full" />
      <div className="skeleton-shimmer mt-4 h-3 w-full rounded-full" />
      <div className="skeleton-shimmer mt-2 h-3 w-4/5 rounded-full" />
    </div>
  );
}

export function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-w-border bg-white p-4 shadow-soft ${className}`}>
      <div className="skeleton-shimmer h-4 w-1/3 rounded-full" />
      <div className="mt-6 flex h-56 items-end gap-3">
        {[44, 70, 58, 86, 64].map((height, index) => (
          <div key={index} className="skeleton-shimmer flex-1 rounded-t-xl" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-2xl border border-w-border bg-white p-3 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="skeleton-shimmer h-10 w-10 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="skeleton-shimmer h-4 w-2/3 rounded-full" />
              <div className="skeleton-shimmer mt-2 h-3 w-1/2 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
