import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info: 'bg-info/10 text-info border-info/20',
  primary: 'bg-primary/10 text-primary border-primary/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  muted: 'bg-muted text-muted-foreground border-border',
};

/** Tones for the computed product badges the API sends as labels. */
const LABEL_TONES = { 'جدید': 'info', 'پرفروش': 'warning' };

export default function Badge({ label, tone, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        TONES[tone || LABEL_TONES[label] || 'muted'],
        className,
      )}
    >
      {label}
    </span>
  );
}
