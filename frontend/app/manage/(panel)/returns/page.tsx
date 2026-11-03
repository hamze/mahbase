"use client";

import Link from "next/link";
import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { completeReturn, listReturns, receiveReturn, returnAction } from "@/lib/api/commerce";
import type { ReturnRequest, ReturnStatus } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";
import { formatNumber, plainNumber } from "@/lib/pricing";

const STATUSES: ReturnStatus[] = ["REQUESTED", "APPROVED", "RECEIVED", "COMPLETED", "REJECTED", "CANCELLED"];

/** Return workflow: approve → receive (resaleable per item) → complete with a refund amount (empty = default). */
export default function ReturnsPage() {
  const can = useCan();
  const { page, query, setQuery, run, errors, notice } = usePagedList(listReturns);
  const [resaleable, setResaleable] = useState<Record<number, boolean>>({});
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const receive = (request: ReturnRequest) =>
    run(() =>
      receiveReturn(request.id, Object.fromEntries(request.items.map((item) => [item.id, resaleable[item.id] ?? true]))),
    );

  return (
    <>
      <Guide section="returns" />
      <h1>{t("nav.returns")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <select value={query.status ?? ""} onChange={(e) => setQuery({ status: e.target.value || undefined })}>
          <option value="">{t("field.status")}: {t("common.all")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`returnStatus.${status}`)}
            </option>
          ))}
        </select>
      </div>
      {page?.results.length === 0 && <p className="card muted">{t("common.empty")}</p>}
      {page?.results.map((request) => (
        <div key={request.id} className="card">
          <div className="spread card-header">
            <div className="row">
              <Link dir="ltr" href={`/manage/orders/${request.order_number}`}>
                {request.order_number}
              </Link>
              <Label prefix="returnStatus" value={request.status} />
              {request.refund_status && <Label prefix="refundStatus" value={request.refund_status} />}
            </div>
            <span className="muted">{new Date(request.created_at).toLocaleString("fa-IR")}</span>
          </div>
          <p>{request.reason}</p>
          <table>
            <thead>
              <tr>
                <th>{t("field.sku")}</th>
                <th>{t("field.product")}</th>
                <th>{t("field.quantity")}</th>
                <th>{t("field.resaleable")}</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item) => (
                <tr key={item.id}>
                  <td dir="ltr">{item.sku}</td>
                  <td>{item.product_name}</td>
                  <td>{formatNumber(plainNumber(item.quantity))}</td>
                  <td>
                    {request.status === "APPROVED" && can("admin.returns.receive") ? (
                      <input
                        type="checkbox"
                        checked={resaleable[item.id] ?? true}
                        onChange={(e) => setResaleable({ ...resaleable, [item.id]: e.target.checked })}
                      />
                    ) : item.resaleable === null ? (
                      t("common.none")
                    ) : (
                      t(item.resaleable ? "common.yes" : "common.no")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            {can("admin.returns.approve") && request.status === "REQUESTED" && (
              <button className="primary" onClick={() => run(() => returnAction(request.id, "approve"))}>
                {t("action.approve")}
              </button>
            )}
            {can("admin.returns.approve") && ["REQUESTED", "APPROVED"].includes(request.status) && (
              <button className="danger" onClick={() => run(() => returnAction(request.id, "reject"))}>
                {t("action.reject")}
              </button>
            )}
            {can("admin.returns.receive") && request.status === "APPROVED" && (
              <button className="primary" onClick={() => receive(request)}>
                {t("action.receive")}
              </button>
            )}
            {can("admin.returns.complete") && request.status === "RECEIVED" && !request.refund_status && (
              <>
                <input
                  placeholder={t("field.refund_amount")}
                  value={amounts[request.id] ?? ""}
                  onChange={(e) => setAmounts({ ...amounts, [request.id]: e.target.value })}
                />
                <button className="primary" onClick={() => run(() => completeReturn(request.id, amounts[request.id] || null))}>
                  {t("action.complete")}
                </button>
              </>
            )}
            {request.status === "COMPLETED" && <span className="muted">{formatNumber(request.refund_amount)}</span>}
          </div>
        </div>
      ))}
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
