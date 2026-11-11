'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import CartLine from '@/components/store/CartLine';

export default function Cart() {
  const { items, subtotal, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-bold text-foreground">سبد خرید شما خالی است</h1>
        <p className="text-sm text-muted-foreground">برای شروع خرید، محصولات را مرور کنید.</p>
        <Link href="/products" className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">مشاهده محصولات</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-foreground md:text-2xl">سبد خرید</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="space-y-3">
            {items.map((item) => <CartLine key={item.variant} item={item} />)}
          </ul>
          <button onClick={clearCart} className="mt-4 text-sm text-muted-foreground hover:text-destructive">خالی کردن سبد</button>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-44 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-4 font-bold text-foreground">خلاصه سبد</h2>
            <div className="flex justify-between border-b border-border pb-3 text-base font-bold">
              <span className="text-foreground">جمع کالاها</span>
              <span className="text-primary">{formatPrice(subtotal)} تومان</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              هزینه ارسال و کد تخفیف در مرحله تکمیل خرید محاسبه می‌شود.
            </p>
            <Link
              href="/checkout"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              ادامه و پرداخت <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
