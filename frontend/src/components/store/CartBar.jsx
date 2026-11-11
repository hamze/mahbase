import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { faNum, formatPrice } from '@/lib/format';

export default function CartBar() {
  const { count, subtotal } = useCart();
  const pathname = usePathname();

  if (count === 0 || pathname === '/cart' || pathname.startsWith('/checkout')) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg">
        <Link href="/cart" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <ShoppingCart className="h-5 w-5 shrink-0 text-primary" />
          <span className="shrink-0 text-xs text-muted-foreground">{faNum(count)} کالا در سبد</span>
          <span className="truncate font-bold text-foreground">{formatPrice(subtotal)} تومان</span>
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link href="/checkout" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
          تکمیل سفارش
        </Link>
      </div>
    </div>
  );
}
