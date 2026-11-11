import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/OrderDetail";
import type { Order } from "@/lib/api/types";
import { serverGet } from "@/lib/server/session";

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await serverGet<Order>(`admin/orders/${encodeURIComponent(number)}/`);
  if (!order) notFound();
  return <OrderDetail initialOrder={order} />;
}
