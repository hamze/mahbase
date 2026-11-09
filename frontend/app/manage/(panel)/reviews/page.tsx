"use client";

import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { approveReview, deleteReview, listReviews, rejectReview } from "@/lib/api/site";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

/** Review moderation by status tab; selected reviews can be approved or rejected together. */
export default function ReviewsPage() {
  const can = useCan();
  const canModerate = can("reviews.moderate");
  const { page, query, setQuery, run, errors, notice } = usePagedList(listReviews, { status: "PENDING" });
  const [selected, setSelected] = useState<number[]>([]);
  const [reason, setReason] = useState("");

  const bulk = (action: (id: number) => Promise<unknown>) =>
    run(async () => {
      for (const id of selected) await action(id);
      setSelected([]);
      setReason("");
    });

  return (
    <>
      <Guide section="reviews" />
      <h1>{t("nav.reviews")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`pill ${query.status === tab ? "active" : ""}`}
            onClick={() => {
              setSelected([]);
              setQuery({ status: tab });
            }}
          >
            {t(`reviewStatus.${tab}`)}
          </button>
        ))}
      </div>
      {canModerate && selected.length > 0 && (
        <div className="card row">
          <span>{t("reviews.selected", { count: selected.length })}</span>
          <button className="primary" onClick={() => bulk(approveReview)}>
            {t("action.approve")}
          </button>
          <input className="grow" placeholder={t("field.reject_reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="danger" disabled={!reason.trim()} onClick={() => bulk((id) => rejectReview(id, reason))}>
            {t("action.reject")}
          </button>
        </div>
      )}
      {page?.results.length === 0 && <p className="card muted">{t("common.empty")}</p>}
      {page?.results.map((review) => (
        <div key={review.id} className="card">
          <div className="spread card-header">
            <div className="row">
              {canModerate && (
                <input
                  type="checkbox"
                  checked={selected.includes(review.id)}
                  onChange={(e) =>
                    setSelected(e.target.checked ? [...selected, review.id] : selected.filter((id) => id !== review.id))
                  }
                />
              )}
              <strong>{review.product_name}</strong>
              <span className="badge">{"★".repeat(review.rating)}</span>
              <Label prefix="reviewStatus" value={review.status} />
            </div>
            <span className="muted" dir="ltr">
              {review.user_mobile} · {review.order_number ?? t("common.none")}
            </span>
          </div>
          {review.title && <strong>{review.title}</strong>}
          <p>{review.body}</p>
          {review.reject_reason && (
            <p className="muted">
              {t("field.reject_reason")}: {review.reject_reason}
            </p>
          )}
          {can("reviews.delete") && (
            <button className="danger" onClick={() => run(() => deleteReview(review.id), t("common.deleted"))}>
              {t("common.delete")}
            </button>
          )}
        </div>
      ))}
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
