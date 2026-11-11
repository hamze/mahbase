'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { categoriesQuery, categoryFiltersQuery, PRODUCTS_PAGE_SIZE, productsQuery } from '@/api/queries';
import { usePriceTier } from '@/lib/AuthContext';
import ProductCard from '@/components/store/ProductCard';
import FilterPanel from '@/components/store/FilterPanel';
import { faNum, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

const SORTS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'popular', label: 'پرفروش‌ترین' },
  { value: 'rating', label: 'بیشترین امتیاز' },
  { value: 'cheapest', label: 'ارزان‌ترین' },
  { value: 'expensive', label: 'گران‌ترین' },
  { value: 'discount', label: 'بیشترین تخفیف' },
];

const flatten = (categories) => categories.flatMap((c) => [c, ...flatten(c.children || [])]);

/** Page numbers around the current page, with ``null`` for gaps. */
function pageWindow(current, total) {
  const pages = [...new Set([1, current - 1, current, current + 1, total])].filter((p) => p >= 1 && p <= total);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const btn = 'grid h-10 min-w-10 place-items-center rounded-xl border border-border px-3 text-sm';
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={cn(btn, 'text-foreground hover:bg-muted disabled:opacity-40')} aria-label="صفحه قبل">
        <ChevronRight className="h-4 w-4" />
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(btn, p === page ? 'border-primary bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}
          >
            {faNum(p)}
          </button>
        ),
      )}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={cn(btn, 'text-foreground hover:bg-muted disabled:opacity-40')} aria-label="صفحه بعد">
        <ChevronLeft className="h-4 w-4" />
      </button>
    </nav>
  );
}

function SearchBox({ initial, onSearch }) {
  const [text, setText] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="جستجو در محصولات"
        className="h-10 w-48 rounded-xl border border-border bg-background pl-3 pr-9 text-sm outline-none focus:border-primary"
      />
    </form>
  );
}

export default function Products() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setParams = (next) => router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  const values = useMemo(() => Object.fromEntries(params), [params]);
  const category = values.category || '';
  const sort = values.sort || 'newest';
  const page = Number(values.page) || 1;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tier = usePriceTier();
  const categories = useQuery(categoriesQuery());
  const filterOptions = useQuery(categoryFiltersQuery(category));
  const products = useQuery({
    ...productsQuery(values, tier),
    placeholderData: keepPreviousData,
  });

  const activeCategory = useMemo(
    () => flatten(categories.data || []).find((c) => c.slug === category),
    [categories.data, category],
  );
  const options = category ? filterOptions.data : null;
  const total = products.data?.count ?? 0;
  const totalPages = Math.ceil(total / PRODUCTS_PAGE_SIZE);

  /** Merge query changes into the URL; any filter change returns to page 1. */
  const update = (changes, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!keepPage) next.delete('page');
    setParams(next);
  };

  const goToPage = (p) => {
    update({ page: p > 1 ? String(p) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chips = [
    ...(values.search ? [{ label: `جستجو: ${values.search}`, changes: { search: '' } }] : []),
    ...(values.in_stock === 'true' ? [{ label: 'فقط موجود', changes: { in_stock: '' } }] : []),
    ...(values.min_price ? [{ label: `از ${formatPrice(values.min_price)} تومان`, changes: { min_price: '' } }] : []),
    ...(values.max_price ? [{ label: `تا ${formatPrice(values.max_price)} تومان`, changes: { max_price: '' } }] : []),
    ...(values.brand || '').split(',').filter(Boolean).map((id) => ({
      label: options?.brands.find((b) => String(b.id) === id)?.name || id,
      changes: { brand: values.brand.split(',').filter((v) => v !== id).join(',') },
    })),
    ...Object.keys(values)
      .filter((key) => key.startsWith('attr_'))
      .flatMap((key) =>
        values[key].split(',').map((v) => ({ label: v, changes: { [key]: values[key].split(',').filter((x) => x !== v).join(',') } })),
      ),
  ];
  const clearFilters = () => setParams(new URLSearchParams(category ? { category } : {}));

  const panel = (onClose) => (
    <FilterPanel
      categories={categories.data || []}
      activeCategory={category}
      options={options}
      values={values}
      onChange={update}
      onClose={onClose}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <ChevronLeft className="h-3 w-3" />
        <Link href="/products" className="hover:text-primary">محصولات</Link>
        {activeCategory && (<><ChevronLeft className="h-3 w-3" /><span className="text-foreground">{activeCategory.name}</span></>)}
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">
          {values.search ? `نتایج جستجو برای «${values.search}»` : activeCategory?.name || 'همه محصولات'}
        </h1>
        {activeCategory?.seo_description && <p className="mt-1 text-sm leading-7 text-muted-foreground">{activeCategory.seo_description}</p>}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> فیلترها
          </button>
          <span className="text-sm text-muted-foreground">{products.isLoading ? 'در حال بارگذاری...' : `${faNum(total)} محصول`}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox key={values.search || ''} initial={values.search || ''} onSearch={(text) => update({ search: text })} />
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => update(chip.changes)}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:border-primary/40"
            >
              {chip.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button onClick={clearFilters} className="text-xs text-primary hover:underline">حذف همه فیلترها</button>
        </div>
      )}

      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-44 rounded-2xl border border-border bg-card/50 p-4">{panel()}</div>
        </aside>

        <div className="flex-1">
          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : products.isError ? (
            <p className="rounded-2xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
              دریافت محصولات انجام نشد. لطفاً دوباره تلاش کنید.
            </p>
          ) : products.data.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
              <Search className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">محصولی با این مشخصات یافت نشد.</p>
              {chips.length > 0 && <button onClick={clearFilters} className="text-sm text-primary hover:underline">حذف همه فیلترها</button>}
            </div>
          ) : (
            <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4', products.isPlaceholderData && 'opacity-60')}>
              {products.data.results.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPage={goToPage} />
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-[85%] max-w-xs overflow-y-auto bg-background p-4 shadow-xl animate-slide-in-right">
            {panel(() => setDrawerOpen(false))}
            <button onClick={() => setDrawerOpen(false)} className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
              نمایش {faNum(total)} محصول
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
