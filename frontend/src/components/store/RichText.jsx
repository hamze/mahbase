import React from 'react';
import { cn } from '@/lib/utils';

/** Backend-sanitized HTML (product descriptions, FAQ and Q&A answers) with basic typography. */
export default function RichText({ html, className }) {
  return (
    <div
      className={cn(
        'text-sm leading-8 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-bold [&_h3]:text-foreground [&_img]:my-3 [&_img]:rounded-xl [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pr-5 [&_p]:mb-2 [&_strong]:text-foreground [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_ul]:list-disc [&_ul]:pr-5',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
