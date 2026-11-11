'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryHref = (slug) => `/products?category=${encodeURIComponent(slug)}`;

/**
 * «همه محصولات» in the desktop nav: opens on hover or click and lists every main category with its subcategories.
 * The panel is positioned against the nearest ``relative`` ancestor (the nav), outside the scrolling link row.
 */
export default function CategoryMenu({ categories }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => setOpen(false), [pathname, search]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!wrapper.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        // Hover has usually opened it already, so a click only opens (closing is Escape, outside click or leaving).
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn('flex items-center gap-1 px-3 py-3 text-sm font-medium transition hover:text-primary', open ? 'text-primary' : 'text-foreground')}
      >
        همه محصولات <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 border-t border-border bg-background shadow-lg animate-fade-in">
          <div className="mx-auto max-w-7xl px-4 py-5">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">دسته‌بندی‌ای ثبت نشده است.</p>
            ) : (
              <div className="grid grid-cols-4 gap-6">
                {categories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <Link href={categoryHref(category.slug)} className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary">
                      {category.icon_url && <img src={category.icon_url} alt="" className="h-5 w-5 object-contain" />}
                      {category.name}
                    </Link>
                    {(category.children || []).length > 0 && (
                      <ul className="space-y-1.5 border-r border-border pr-3">
                        {category.children.map((child) => (
                          <li key={child.id}>
                            <Link href={categoryHref(child.slug)} className="text-sm text-muted-foreground transition hover:text-primary">
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link href="/products" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              مشاهده همه محصولات <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
