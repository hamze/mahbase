'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { getMyOrder, payOrder } from '@/api/orders';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/cart-context';

const STATES = {
  success: {
    icon: Check,
    tone: 'bg-success/10 text-success',
    title: 'پرداخت با موفقیت انجام شد',
    text: 'سفارش شما ثبت و پرداخت شد و به‌زودی آماده‌سازی می‌شود.',
  },
  failed: {
    icon: X,
    tone: 'bg-destructive/10 text-destructive',
    title: 'پرداخت ناموفق بود',
    text: 'مبلغی از حساب شما کسر نشده است یا طی چند ساعت بازگردانده می‌شود. می‌توانید دوباره پرداخت کنید.',
  },
  error: {
    icon: AlertTriangle,
    tone: 'bg-warning/15 text-warning',
    title: 'تأیید پرداخت انجام نشد',
    text: 'وضعیت پرداخت مشخص نشد. وضعیت سفارش را از صفحه سفارش پیگیری کنید.',
  },
};

const PAYABLE = ['UNPAID', 'PENDING', 'FAILED'];

/** Where the bank flow lands: ``?order=<n>&status=success|failed|error&result=<txn status>&ref=<tracking code>``. */
export default function CheckoutResult() {
  const params = useSearchParams();
  const orderNumber = params.get('order');
  const ref = params.get('ref');
  const status = STATES[params.get('status')] ? params.get('status') : 'error';
  const state = STATES[status];
  const Icon = state.icon;
  const { isAuthenticated } = useAuth();
  const { refresh } = useCart();
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (status === 'success') refresh();
  }, [status, refresh]);

  const order = useQuery({
    queryKey: ['my-order', orderNumber],
    staleTime: 0,
    queryFn: () => getMyOrder(orderNumber),
    enabled: status === 'failed' && isAuthenticated && Boolean(orderNumber),
  });
  const payable =
    order.data?.stock_reservation_status === 'RESERVED' && PAYABLE.includes(order.data.payment_status);

  const payAgain = async () => {
    setPaying(true);
    try {
      const { payment_redirect_url: url } = await payOrder(orderNumber);
      window.location.href = url;
    } catch (error) {
      toast.error(error.messages?.[0] || 'اتصال به درگاه پرداخت برقرار نشد.');
      setPaying(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${state.tone}`}>
        <Icon className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-foreground">{state.title}</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{state.text}</p>

      <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        {orderNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">شماره سفارش</span>
            <span className="font-medium text-foreground" dir="ltr">{orderNumber}</span>
          </div>
        )}
        {ref && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">کد پیگیری</span>
            <span className="font-medium text-foreground" dir="ltr">{ref}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {payable && (
          <button
            onClick={payAgain}
            disabled={paying}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" />} پرداخت دوباره
          </button>
        )}
        {orderNumber && (
          <Link href={`/account/orders/${orderNumber}`} className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted">
            مشاهده سفارش
          </Link>
        )}
        <Link href="/products" className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted">
          ادامه خرید
        </Link>
      </div>
    </div>
  );
}
