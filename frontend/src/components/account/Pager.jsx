import React from 'react';
import { faNum } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

/** Page-number pagination for the backend's ``{count}`` lists (page size 50). */
export default function Pager({ page, count, onChange, pageSize = PAGE_SIZE }) {
  const pages = Math.ceil((count || 0) / pageSize);
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 2,
  );
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="صفحه‌بندی">
      {numbers.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <button
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-sm transition',
              n === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
            )}
          >
            {faNum(n)}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
