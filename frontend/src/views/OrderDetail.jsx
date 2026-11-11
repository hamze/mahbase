'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, CreditCard, Loader2, Printer, RotateCcw } from 'lucide-react';
import { getMyOrder, payOrder, requestReturn } from '@/api/orders';
import { formatPrice, formatQuantity } from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import { orderTotalRows, printOrders } from '@/lib/print';
import { useStoreSettings } from '@/hooks/use-site-content';
import OrderBadges from '@/components/account/OrderBadges';
import { addressText } from '@/components/account/AddressesTab';
import {
  REFUND_REASON, REFUND_STATUS, RETURN_STATUS, TRANSACTION_STATUS,
} from '@/components/account/order-labels';
import { GeneralError, splitApiErrors } from '@/components/account/form-errors';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAYABLE_STATUSES = ['UNPAID', 'PENDING', 'FAILED'];

function Section({ title, children, className }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4 md:p-5', className)}>
      <h2 className="mb-3 font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const remainingQuantity = (item) => Number(item.quantity) - Number(item.returned_quantity || 0);

function ReturnRequestForm({ order, onDone }) {
  const returnable = order.items.filter((item) => remainingQuantity(item) > 0);
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);

  if (returnable.length === 0) return null;

  const toggle = (item) =>
    setQuantities((q) => {
      const next = { ...q };
      if (item.id in next) delete next[item.id];
      else next[item.id] = String(remainingQuantity(item));
      return next;
    });

  const selected = Object.entries(quantities).filter(([, quantity]) => Number(quantity) > 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await requestReturn(
        order.order_number,
        reason.trim(),
        selected.map(([id, quantity]) => ({ order_item: Number(id), quantity })),
      );
      toast.success('درخواست مرجوعی ثبت شد.');
      setQuantities({});
      setReason('');
      onDone();
    } catch (err) {
      setErrors(splitApiErrors(err, []));
    }
    setBusy(false);
  };

  return (
    <Section title="درخواست مرجوعی">
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">کالاها و مقدار مرجوعی را انتخاب کنید.</p>
        {returnable.map((item) => {
          const max = remainingQuantity(item);
          const checked = item.id in quantities;
          return (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checked} onChange={() => toggle(item)} className="h-4 w-4 accent-primary" />
                <span className="text-foreground">
                  {item.product_name_snapshot}
                  {item.variant_label_snapshot && <span className="text-muted-foreground"> — {item.variant_label_snapshot}</span>}
                </span>
              </label>
              {checked && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="number"
                    min="0"
                    max={max}
                    step="any"
                    dir="ltr"
                    value={quantities[item.id]}
                    onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                    className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                  />
                  <span>از {formatQuantity(max)} {item.unit_name_snapshot}</span>
                </div>
              )}
            </div>
          );
        })}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">دلیل مرجوعی *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <GeneralError errors={errors} />
        <Button type="submit" disabled={busy || selected.length === 0 || !reason.trim()} className="gap-2 rounded-xl">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} ثبت درخواست مرجوعی
        </Button>
      </form>
    </Section>
  );
}

export default function OrderDetail({ orderNumber }) {
  const queryClient = useQueryClient();
  const settings = useStoreSettings();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['my-order', orderNumber],
    staleTime: 0,
    queryFn: () => getMyOrder(orderNumber),
    retry: (count, err) => err.status !== 404 && count < 1,
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-8"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{error?.status === 404 ? 'سفارش مورد نظر یافت نشد.' : 'دریافت سفارش انجام نشد.'}</p>
        <Link href="/account?tab=orders" className="mt-3 inline-block text-sm text-primary hover:underline">بازگشت به سفارش‌ها</Link>
      </div>
    );
  }

  const canPay = order.stock_reservation_status === 'RESERVED' && PAYABLE_STATUSES.includes(order.payment_status);
  const reload = () => queryClient.invalidateQueries({ queryKey: ['my-order', orderNumber] });
  const address = order.address || {};

  const pay = async () => {
    setPaying(true);
    setPayError('');
    try {
      const { payment_redirect_url: url } = await payOrder(order.order_number);
      window.location.href = url;
    } catch (err) {
      setPayError(err.messages?.join(' ') || 'اتصال به درگاه پرداخت انجام نشد.');
      setPaying(false);
      reload();
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/account?tab=orders" className="flex items-center gap-1 hover:text-primary">
          <ChevronRight className="h-3.5 w-3.5" /> سفارش‌های من
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-foreground md:text-xl">سفارش {order.order_number}</h1>
          <div className="text-xs text-muted-foreground">
            ثبت: {formatJalali(order.placed_at, true)}
            {order.paid_at && <> • پرداخت: {formatJalali(order.paid_at, true)}</>}
          </div>
          <OrderBadges order={order} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPay && (
            <Button onClick={pay} disabled={paying} className="gap-2 rounded-xl">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} پرداخت
            </Button>
          )}
          <Button variant="outline" onClick={() => printOrders([order], settings?.store_name)} className="gap-2 rounded-xl">
            <Printer className="h-4 w-4" /> چاپ فاکتور
          </Button>
        </div>
        {canPay && order.reservation_expires_at && (
          <p className="w-full text-xs text-warning">
            کالاهای این سفارش تا {formatJalali(order.reservation_expires_at, true)} برای شما رزرو شده‌اند؛ پیش از آن پرداخت کنید.
          </p>
        )}
        {payError && <p className="w-full rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{payError}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="اقلام سفارش">
            <div className="overflow-hidden rounded-xl border border-border text-sm">
              {order.items.map((item, i) => (
                <div key={item.id} className={cn('flex flex-wrap items-center justify-between gap-2 px-3 py-2.5', i % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                  <div className="min-w-0">
                    <div className="text-foreground">{item.product_name_snapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.variant_label_snapshot && <>{item.variant_label_snapshot} • </>}
                      {formatQuantity(item.quantity)} {item.unit_name_snapshot} × {formatPrice(item.unit_price)} تومان
                      {Number(item.returned_quantity) > 0 && <> • مرجوع‌شده: {formatQuantity(item.returned_quantity)}</>}
                    </div>
                  </div>
                  <div className="font-medium text-foreground">{formatPrice(item.line_total)} تومان</div>
                </div>
              ))}
            </div>
          </Section>

          {order.payments?.length > 0 && (
            <Section title="پرداخت‌ها">
              <div className="space-y-2 text-sm">
                {order.payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="space-y-1">
                      <div className="text-foreground">{TRANSACTION_STATUS[p.status] || p.status}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatJalali(p.paid_at || p.created_at, true)}
                        {p.gateway_transaction_id && <> • کد پیگیری: <span dir="ltr" className="font-medium text-foreground">{p.gateway_transaction_id}</span></>}
                      </div>
                    </div>
                    <div className="font-medium text-foreground">{formatPrice(p.amount)} تومان</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {order.return_requests?.length > 0 && (
            <Section title="درخواست‌های مرجوعی">
              <div className="space-y-2 text-sm">
                {order.return_requests.map((r) => (
                  <div key={r.id} className="space-y-1 rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{RETURN_STATUS[r.status] || r.status}</span>
                      <span className="text-xs text-muted-foreground">{formatJalali(r.created_at, true)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.items.map((it) => `${it.product_name} (${formatQuantity(it.quantity)})`).join('، ')}
                    </div>
                    <div className="text-xs text-muted-foreground">دلیل: {r.reason}</div>
                    {Number(r.refund_amount) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        مبلغ بازپرداخت: {formatPrice(r.refund_amount)} تومان
                        {r.refund_status && <> ({REFUND_STATUS[r.refund_status] || r.refund_status})</>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {order.refunds?.length > 0 && (
            <Section title="بازپرداخت‌ها">
              <div className="space-y-2 text-sm">
                {order.refunds.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="space-y-1">
                      <div className="text-foreground">{REFUND_REASON[r.reason] || r.reason} — {REFUND_STATUS[r.status] || r.status}</div>
                      <div className="text-xs text-muted-foreground">{formatJalali(r.completed_at || r.created_at, true)}</div>
                    </div>
                    <div className="font-medium text-foreground">{formatPrice(r.amount)} تومان</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {order.order_status === 'DELIVERED' && <ReturnRequestForm order={order} onDone={reload} />}
        </div>

        <div className="space-y-4">
          <Section title="خلاصه پرداخت">
            <div className="space-y-2 text-sm">
              {orderTotalRows(order).map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={row.negative ? 'text-success' : 'text-foreground'}>
                    {row.negative && '− '}{formatPrice(row.value)} تومان
                  </span>
                </div>
              ))}
              <div className="flex justify-between gap-2 border-t border-border pt-2 font-bold">
                <span>مبلغ قابل پرداخت</span>
                <span className="text-primary">{formatPrice(order.payable_total)} تومان</span>
              </div>
              {Number(order.paid_total) > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">پرداخت‌شده</span>
                  <span>{formatPrice(order.paid_total)} تومان</span>
                </div>
              )}
              {Number(order.refunded_total) > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">بازپرداخت‌شده</span>
                  <span>{formatPrice(order.refunded_total)} تومان</span>
                </div>
              )}
            </div>
          </Section>

          <Section title="آدرس تحویل">
            <div className="space-y-1 text-sm">
              <div className="text-foreground">{address.receiver_name} — <span dir="ltr">{address.receiver_mobile}</span></div>
              <div className="leading-6 text-muted-foreground">
                {addressText(address)}
              </div>
              {address.postal_code && <div className="text-xs text-muted-foreground">کد پستی: <span dir="ltr">{address.postal_code}</span></div>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
