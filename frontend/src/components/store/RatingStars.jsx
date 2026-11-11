import React from 'react';
import { Star } from 'lucide-react';
import { faNum } from '@/lib/format';

/** Five stars filled to the rounded average, with the average and the number of approved reviews. */
export default function RatingStars({ average, count, size = 'h-3.5 w-3.5' }) {
  const value = Number(average) || 0;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={star <= Math.round(value) ? `${size} fill-warning text-warning` : `${size} text-muted-foreground/30`} />
        ))}
      </div>
      {count > 0 && <span>{faNum(value)} ({faNum(count)} نظر)</span>}
    </div>
  );
}
