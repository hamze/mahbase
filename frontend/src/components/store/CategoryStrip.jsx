import React from 'react';
import Link from 'next/link';

function CategoryCard({ category }) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="group flex w-24 shrink-0 flex-col items-center gap-2 md:w-28"
    >
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40 transition group-hover:border-primary/40 md:h-24 md:w-24">
        {category.icon_url ? (
          <img src={category.icon_url} alt={category.name} className="h-10 w-10 object-contain" />
        ) : (
          <span className="text-2xl font-bold text-primary/60">{category.name[0]}</span>
        )}
      </div>
      <span className="text-center text-xs font-medium text-foreground md:text-sm">{category.name}</span>
    </Link>
  );
}

export default function CategoryStrip({ categories }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <h2 className="mb-4 text-lg font-medium text-foreground md:text-xl">دسته‌بندی‌ها</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {categories.map((category) => <CategoryCard key={category.id} category={category} />)}
      </div>
    </section>
  );
}
