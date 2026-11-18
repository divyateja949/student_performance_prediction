import type { PerformanceCategory } from '../types';

interface CategoryLabelProps {
  category: PerformanceCategory;
  compact?: boolean;
}

const CATEGORY_STYLES: Record<
  PerformanceCategory,
  { text: string; marker: string; range: string }
> = {
  Excellent: {
    text: 'text-emerald-700',
    marker: 'bg-emerald-600',
    range: '85–100',
  },
  Good: {
    text: 'text-blue-700',
    marker: 'bg-blue-600',
    range: '70–84',
  },
  Average: {
    text: 'text-amber-700',
    marker: 'bg-amber-600',
    range: '50–69',
  },
  'At Risk': {
    text: 'text-red-700',
    marker: 'bg-red-600',
    range: 'Below 50',
  },
};

export function CategoryLabel({ category, compact = false }: CategoryLabelProps) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Average;
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-[2px] shrink-0 ${style.marker}`} aria-hidden="true" />
      <span>{category}</span>
      {!compact && (
        <span className="font-normal text-slate-400 font-mono tabular-nums">
          ({style.range})
        </span>
      )}
    </span>
  );
}
