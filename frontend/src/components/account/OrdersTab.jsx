import React, { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { listMyOrders } from '@/api/orders';
import { formatPrice } from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import OrderBadges from './OrderBadges';
import Pager from './Pager';

export default function OrdersTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page],
    staleTime: 0,
    queryFn: () => listMyOrders(page),
    placeholderData: keepPreviousData,
  });
  const orders = data?.results || [];

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;
  if (orders.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</div>;
  }

  return (
    <div>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/account/orders/${encodeURIComponent(o.order_number)}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30"
          >
            <div className="space-y-1">
              <div className="font-medium text-foreground">سفارش {o.order_number}</div>
              <div className="text-xs text-muted-foreground">
                {formatJalali(o.placed_at, true)} • {formatPrice(o.payable_total)} تومان
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OrderBadges order={o} />
              <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
      <Pager page={page} count={data.count} onChange={setPage} />
    </div>
  );
}
