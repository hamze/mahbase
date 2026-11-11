import React from 'react';
import Link from 'next/link';
import { X, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import CartLine from './CartLine';
import { cn } from '@/lib/utils';

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, subtotal } = useCart();
  const close = () => setIsOpen(false);

  return (
    <>
      <div
        className={cn('fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity', isOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={close}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col bg-background shadow-xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-bold text-foreground">
            <ShoppingBag className="h-5 w-5" /> سبد خرید
          </h2>
          <button onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">سبد خرید شما خالی است</p>
              <Link href="/products" onClick={close} className="text-sm font-medium text-primary hover:underline">
                مشاهده محصولات
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => <CartLine key={item.variant} item={item} compact onNavigate={close} />)}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">جمع کالاها</span>
              <span className="text-lg font-bold text-foreground">{formatPrice(subtotal)} تومان</span>
            </div>
            <Link
              href="/cart"
              onClick={close}
              className="mb-2 block w-full rounded-xl border border-border py-3 text-center text-sm font-medium text-foreground transition hover:bg-muted"
            >
              مشاهده سبد خرید
            </Link>
            <Link
              href="/checkout"
              onClick={close}
              className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              ادامه و پرداخت
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
