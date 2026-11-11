import React from 'react';
import Badge from '@/components/store/Badge';
import { ORDER_STATUS, PAYMENT_STATUS } from './order-labels';

export default function OrderBadges({ order }) {
  const status = ORDER_STATUS[order.order_status];
  const payment = PAYMENT_STATUS[order.payment_status];
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge label={status?.label || order.order_status} tone={status?.tone} />
      <Badge label={payment?.label || order.payment_status} tone={payment?.tone} />
    </span>
  );
}
