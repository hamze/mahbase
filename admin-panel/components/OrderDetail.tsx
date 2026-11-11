"use client";

import Link from "next/link";
import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { cancelOrder, getOrder, setOrderStatus, setPreparationStatus } from "@/lib/api/commerce";
import { errorMessages } from "@/lib/api/errors";
import type { Order, PreparationStatus } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";
import { formatNumber, plainNumber } from "@/lib/pricing";

const PREPARATION: PreparationStatus[] = ["PENDING", "PREPARING", "PREPARED"];
const CANCELLABLE = ["PENDING_PAYMENT", "IN_PREPARATION", "READY_TO_SHIP"];

/** One order: lines with preparation status, address snapshot, totals, payments, refunds, returns and actions. */
export function OrderDetail({ initialOrder }: { initialOrder: Order }) {
  const can = useCan();
  const [order, setOrder] = useState(initialOrder);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const run = async (action: () => Promise<unknown>, success: string = t("common.saved")) => {
    setErrors([]);
    setNotice(undefined);
    try {
      await action();
      setOrder(await getOrder(order.order_number));
      setNotice(success);
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const cancel = () => {
    if (!window.confirm(t("action.cancelOrderConfirm"))) return;
    const paid = order.payment_status === "PAID";
    run(() => cancelOrder(order.order_number), paid ? t("orders.refundCreated") : t("common.saved"));
  };

  const totals: [MessageKey, string][] = [
    ["orders.subtotal", order.subtotal_products],
    ["orders.productDiscount", order.product_discount_total],
    ["orders.codeDiscount", order.discount_amount],
    ["orders.shipping", order.shipping_cost],
    ["orders.shippingDiscount", order.shipping_discount_amount],
    ["field.payable_total", order.payable_total],
    ["orders.paid", order.paid_total],
    ["orders.refunded", order.refunded_total],
  ];

  return (
    <>
      <Guide section="orders" />
      <div className="spread">
        <h1 dir="ltr">{order.order_number}</h1>
        <div className="row">
          {can("admin.orders.status") &&
            order.manual_next_statuses.map((status) => (
              <button key={status} className="primary" onClick={() => run(() => setOrderStatus(order.order_number, status))}>
                {t("action.moveTo", { status: t(`orderStatus.${status}`) })}
              </button>
            ))}
          {can("admin.orders.cancel") && CANCELLABLE.includes(order.order_status) && (
            <button className="danger" onClick={cancel}>
              {t("action.cancelOrder")}
            </button>
          )}
        </div>
      </div>
      <Messages errors={errors} notice={notice} />
      {order.stock_invalidated && <p className="errors">{t("orders.stockInvalidated")}</p>}
      <div className="card row">
        <span>{order.customer}</span>
        <Label prefix="tier" value={order.customer_tier_snapshot} />
        <Label prefix="orderStatus" value={order.order_status} />
        <Label prefix="paymentStatus" value={order.payment_status} />
        <Label prefix="reservation" value={order.stock_reservation_status} />
        <span className="muted">{new Date(order.placed_at).toLocaleString("fa-IR")}</span>
      </div>

      <div className="card table-scroll">
        <h2 className="card-title">{t("orders.items")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("field.sku")}</th>
              <th>{t("field.product")}</th>
              <th>{t("field.quantity")}</th>
              <th>{t("field.unit_price")}</th>
              <th>{t("field.line_total")}</th>
              <th>{t("field.preparation_status")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td dir="ltr">{item.sku_snapshot}</td>
                <td>
                  {item.product_name_snapshot}
                  {item.variant_label_snapshot && <span className="muted"> — {item.variant_label_snapshot}</span>}
                </td>
                <td>
                  {formatNumber(plainNumber(item.quantity))} {item.unit_name_snapshot}
                  {Number(item.returned_quantity) > 0 && (
                    <span className="muted"> ({t("nav.returns")}: {formatNumber(plainNumber(item.returned_quantity))})</span>
                  )}
                </td>
                <td>{formatNumber(item.unit_price)}</td>
                <td>{formatNumber(item.line_total)}</td>
                <td>
                  <select
                    value={item.preparation_status}
                    disabled={!can("admin.orders.edit")}
                    onChange={(e) =>
                      run(() => setPreparationStatus(order.order_number, item.id, e.target.value as PreparationStatus))
                    }
                  >
                    {PREPARATION.map((status) => (
                      <option key={status} value={status}>
                        {t(`preparation.${status}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tiles">
        {order.address && (
          <div className="card">
            <h2 className="card-title">{t("orders.address")}</h2>
            <p>
              {order.address.receiver_name} — <span dir="ltr">{order.address.receiver_mobile}</span>
            </p>
            <p className="muted">
              {order.address.province_name}، {order.address.city_name}، {order.address.address_line}
              {order.address.plaque && ` — ${t("orders.plaque")} ${order.address.plaque}`}
              {order.address.unit && ` — ${t("orders.unit")} ${order.address.unit}`}
            </p>
            <p className="muted" dir="ltr">
              {order.address.postal_code}
            </p>
          </div>
        )}
        <div className="card">
          <h2 className="card-title">{t("orders.totals")}</h2>
          <table>
            <tbody>
              {totals.map(([label, value]) => (
                <tr key={label}>
                  <th>{t(label)}</th>
                  <td>{formatNumber(value)}</td>
                </tr>
              ))}
              {order.discount_code_snapshot && (
                <tr>
                  <th>{t("field.code")}</th>
                  <td dir="ltr">{order.discount_code_snapshot}</td>
                </tr>
              )}
              {order.shipping_method_name_snapshot && (
                <tr>
                  <th>{t("nav.shipping")}</th>
                  <td>{order.shipping_method_name_snapshot}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card table-scroll">
        <h2 className="card-title">{t("orders.payments")}</h2>
        <table>
          <tbody>
            {order.payments.length === 0 && (
              <tr>
                <td className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {order.payments.map((payment) => (
              <tr key={payment.id}>
                <td dir="ltr">{payment.gateway_transaction_id ?? t("common.none")}</td>
                <td>{formatNumber(payment.amount)}</td>
                <td dir="ltr">{payment.status}</td>
                <td>{new Date(payment.created_at).toLocaleString("fa-IR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-scroll">
        <div className="spread card-header">
          <h2 className="card-title">{t("orders.refunds")}</h2>
          <Link href="/manage/refunds">{t("nav.refunds")}</Link>
        </div>
        <table>
          <tbody>
            {order.refunds.length === 0 && (
              <tr>
                <td className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {order.refunds.map((refund) => (
              <tr key={refund.id}>
                <td>
                  <Label prefix="refundReason" value={refund.reason} />
                </td>
                <td>{formatNumber(refund.amount)}</td>
                <td>
                  <Label prefix="refundStatus" value={refund.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-scroll">
        <div className="spread card-header">
          <h2 className="card-title">{t("orders.returns")}</h2>
          <Link href="/manage/returns">{t("nav.returns")}</Link>
        </div>
        <table>
          <tbody>
            {order.return_requests.length === 0 && (
              <tr>
                <td className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {order.return_requests.map((request) => (
              <tr key={request.id}>
                <td>{request.reason}</td>
                <td>{request.items.map((item) => `${item.sku} × ${plainNumber(item.quantity)}`).join("، ")}</td>
                <td>
                  <Label prefix="returnStatus" value={request.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
