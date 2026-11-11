"use client";

import Link from "next/link";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listRefunds, refundAction } from "@/lib/api/commerce";
import type { RefundStatus } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

const STATUSES: RefundStatus[] = ["REQUESTED", "APPROVED", "PROCESSING", "COMPLETED", "FAILED", "REJECTED"];

/** Refund workflow: approve/reject requests, then send approved (or failed) refunds to the gateway. */
export default function RefundsPage() {
  const can = useCan();
  const { page, query, setQuery, run, errors, notice } = usePagedList(listRefunds);

  return (
    <>
      <Guide section="returns" />
      <h1>{t("nav.refunds")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <select value={query.status ?? ""} onChange={(e) => setQuery({ status: e.target.value || undefined })}>
          <option value="">{t("field.status")}: {t("common.all")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`refundStatus.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("field.order_number")}</th>
              <th>{t("field.reason")}</th>
              <th>{t("field.amount")}</th>
              <th>{t("field.status")}</th>
              <th>{t("field.created_at")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {page?.results.map((refund) => (
              <tr key={refund.id}>
                <td dir="ltr">
                  <Link href={`/manage/orders/${refund.order_number}`}>{refund.order_number}</Link>
                </td>
                <td>
                  <Label prefix="refundReason" value={refund.reason} />
                </td>
                <td>{formatNumber(refund.amount)}</td>
                <td>
                  <Label prefix="refundStatus" value={refund.status} tone={refund.status === "COMPLETED" ? "ok" : refund.status === "FAILED" ? "off" : undefined} />
                </td>
                <td>{new Date(refund.created_at).toLocaleString("fa-IR")}</td>
                <td>
                  <div className="row">
                    {can("admin.refunds.approve") && refund.status === "REQUESTED" && (
                      <>
                        <button className="small primary" onClick={() => run(() => refundAction(refund.id, "approve"))}>
                          {t("action.approve")}
                        </button>
                        <button className="small danger" onClick={() => run(() => refundAction(refund.id, "reject"))}>
                          {t("action.reject")}
                        </button>
                      </>
                    )}
                    {can("admin.refunds.complete") && (refund.status === "APPROVED" || refund.status === "FAILED") && (
                      <button className="small primary" onClick={() => run(() => refundAction(refund.id, "process"))}>
                        {t("action.process")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} query={query} setQuery={setQuery} />
      </div>
    </>
  );
}
