'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, ArrowLeft, Newspaper } from 'lucide-react';
import { blogCategoriesQuery, blogPostsQuery } from '@/api/queries';
import { formatJalali } from '@/lib/jalali';
import { useStoreSettings } from '@/hooks/use-site-content';
import { Image } from '@/components/ui/image';
import Pager from '@/components/account/Pager';
import { cn } from '@/lib/utils';

export default function Blog() {
  const settings = useStoreSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const category = searchParams.get('category') || '';
  const page = Number(searchParams.get('page')) || 1;

  const { data: categoriesData } = useQuery(blogCategoriesQuery());
  const categories = categoriesData?.results || categoriesData || [];
  const { data, isLoading } = useQuery({
    ...blogPostsQuery(category, page),
    placeholderData: keepPreviousData,
  });
  const posts = data?.results || [];

  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Newspaper className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">بلاگ {settings?.store_name}</h1>
      </div>

      {categories.length > 0 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
          {[{ slug: '', name: 'همه' }, ...categories].map((c) => (
            <button
              key={c.slug || 'all'}
              onClick={() => update({ category: c.slug, page: null })}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm transition',
                category === c.slug ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">هنوز نوشته‌ای منتشر نشده است.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${encodeURIComponent(p.slug)}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/30">
              <div className="aspect-video overflow-hidden bg-muted">
                <Image src={p.cover_image_url} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {p.published_at && (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatJalali(p.published_at)}
                    </span>
                  )}
                  {p.category_name && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{p.category_name}</span>}
                </div>
                <h2 className="font-bold leading-7 text-foreground group-hover:text-primary">{p.title}</h2>
                {p.excerpt && <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{p.excerpt}</p>}
                <span className="mt-auto flex items-center gap-1 pt-2 text-sm text-primary">ادامه مطلب <ArrowLeft className="h-4 w-4" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && <Pager page={page} count={data.count} onChange={(n) => update({ page: n > 1 ? String(n) : null })} />}
    </div>
  );
}
