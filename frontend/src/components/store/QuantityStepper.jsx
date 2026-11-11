import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';

const decimals = (value) => (String(value ?? '').split('.')[1] || '').replace(/0+$/, '').length;

/**
 * The quantity one step away from ``value`` (direction +1/-1), kept inside [min, max] and on the step's precision.
 * Quantities are API decimal strings; the result is a string with the step's number of decimals.
 */
export function stepQuantity(value, direction, { step, min, max }) {
  const places = Math.max(decimals(step), decimals(min));
  const next = Number(value) + direction * Number(step);
  const bounded = Math.min(Math.max(next, Number(min)), Number(max));
  return bounded.toFixed(places);
}

const SIZES = {
  sm: { box: 'h-8', button: 'h-8 w-8', icon: 'h-3.5 w-3.5', text: 'min-w-[2.5rem] text-xs' },
  md: { box: 'h-11', button: 'h-11 w-11', icon: 'h-4 w-4', text: 'min-w-[3.5rem] text-sm' },
};

/** Presentational +/- control for a decimal quantity honouring purchase_step / min_purchase / max_purchase. */
export default function QuantityStepper({ value, step, min, max, unit, onChange, disabled = false, size = 'md', className }) {
  const s = SIZES[size];
  const limits = { step, min, max };
  const lower = stepQuantity(value, -1, limits);
  const higher = stepQuantity(value, 1, limits);
  return (
    <div className={cn('flex items-center rounded-xl border border-border', s.box, className)}>
      <button
        type="button"
        onClick={() => onChange(lower)}
        disabled={disabled || Number(lower) >= Number(value)}
        className={cn('grid place-items-center text-muted-foreground hover:text-primary disabled:opacity-40', s.button)}
        aria-label="کاهش"
      >
        <Minus className={s.icon} />
      </button>
      <span className={cn('px-1 text-center font-medium text-foreground', s.text)}>
        {formatQuantity(value)}
        {unit && <span className="mr-1 text-muted-foreground">{unit}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(higher)}
        disabled={disabled || Number(higher) <= Number(value)}
        className={cn('grid place-items-center text-muted-foreground hover:text-primary disabled:opacity-40', s.button)}
        aria-label="افزایش"
      >
        <Plus className={s.icon} />
      </button>
    </div>
  );
}
