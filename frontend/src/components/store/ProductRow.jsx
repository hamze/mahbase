import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ProductCard from './ProductCard';

export default function ProductRow({ title, to, products }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-bold text-foreground md:text-xl">{title}</h2>
        {to && (
          <Link href={to} className="flex items-center gap-1 text-sm text-primary hover:underline">
            مشاهده همه <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {products.map((product) => (
          <div key={product.id} className="w-[180px] shrink-0 snap-start sm:w-[240px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
