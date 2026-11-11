"use client";

import Link from "next/link";
import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listOrders } from "@/lib/api/commerce";
import type { OrderStatus, PaymentStatus } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT", "IN_PREPARATION", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"];

/** All orders with status filters; the address and cart guides explain where order data comes from. */
export function OrdersList({ initialSearch }: { initialSearch?: string }) {
  const { page, query, setQuery, errors } = usePagedList(listOrders, { search: initialSearch });
  const [filters, setFilters] = useState(query);
  const can = useCan();

  return (
    <>
      <Guide section="orders" />
      <Guide section="addresses" />
      <Guide section="cart" />
      <div className="spread">
        <h1>{t("nav.orders")}</h1>
        {can("admin.orders.create") && (
          <Link className="button" href="/manage/orders/new">
            {t("nav.newOrder")}
          </Link>
        )}
      </div>
      <Messages errors={errors} />
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...filters, page: undefined });
        }}
      >
        <input
          placeholder={t("orders.searchPlaceholder")}
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        <select value={filters.order_status ?? ""} onChange={(e) => setFilters({ ...filters, order_status: e.target.value || undefined })}>
          <option value="">{t("field.order_status")}: {t("common.all")}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`orderStatus.${status}`)}
            </option>
          ))}
        </select>
        <select
          value={filters.payment_status ?? ""}
          onChange={(e) => setFilters({ ...filters, payment_status: e.target.value || undefined })}
        >
          <option value="">{t("field.payment_status")}: {t("common.all")}</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`paymentStatus.${status}`)}
            </option>
          ))}
        </select>
        <button type="submit">{t("common.filter")}</button>
      </form>
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("field.order_number")}</th>
              <th>{t("field.customer")}</th>
              <th>{t("field.order_status")}</th>
              <th>{t("field.payment_status")}</th>
              <th>{t("field.reservation_status")}</th>
              <th>{t("field.payable_total")}</th>
              <th>{t("field.placed_at")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {page?.results.map((order) => (
              <tr key={order.id}>
                <td dir="ltr">
                  <Link href={`/manage/orders/${order.order_number}`}>{order.order_number}</Link>
                </td>
                <td dir="ltr">{order.customer}</td>
                <td>
                  <Label prefix="orderStatus" value={order.order_status} />
                </td>
                <td>
                  <Label prefix="paymentStatus" value={order.payment_status} tone={order.payment_status === "PAID" ? "ok" : undefined} />
                </td>
                <td>
                  <Label prefix="reservation" value={order.stock_reservation_status} tone={order.stock_invalidated ? "off" : undefined} />
                </td>
                <td>{formatNumber(order.payable_total)}</td>
                <td>{new Date(order.placed_at).toLocaleString("fa-IR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} query={query} setQuery={setQuery} />
      </div>
    </>
  );
}
