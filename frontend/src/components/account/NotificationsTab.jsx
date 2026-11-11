import React, { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { listNotifications, markNotificationRead } from '@/api/account';
import { formatJalali } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import Pager from './Pager';

export default function NotificationsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    staleTime: 0,
    queryFn: () => listNotifications(page),
    placeholderData: keepPreviousData,
  });
  const notifications = data?.results || [];

  const markRead = async (notification) => {
    if (notification.status !== 'NEW') return;
    await markNotificationRead(notification.id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;
  if (notifications.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">اعلانی ندارید.</div>;
  }

  return (
    <div>
      <div className="space-y-3">
        {notifications.map((n) => {
          const isNew = n.status === 'NEW';
          const orderNumber = n.order_number;
          return (
            <div
              key={n.id}
              onClick={() => markRead(n)}
              className={cn('rounded-2xl border bg-card p-4', isNew ? 'cursor-pointer border-primary/40' : 'border-border')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    {n.title}
                  </div>
                  {n.body && <p className="text-sm leading-6 text-muted-foreground">{n.body}</p>}
                  <div className="text-xs text-muted-foreground">{formatJalali(n.created_at, true)}</div>
                </div>
                {isNew && (
                  <button type="button" className="shrink-0 text-xs text-primary hover:underline">
                    علامت‌گذاری خوانده‌شده
                  </button>
                )}
              </div>
              {orderNumber && (
                <Link
                  href={`/account/orders/${encodeURIComponent(orderNumber)}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  مشاهده سفارش <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <Pager page={page} count={data.count} onChange={setPage} />
    </div>
  );
}
