"use client";

import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { answerQuestion, listQuestions, questionAction } from "@/lib/api/commerce";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

const STATUSES = ["PENDING", "ANSWERED", "REJECTED"] as const;

/** Product question moderation: answer (sanitized by Django), reject, or toggle public display. */
export default function QuestionsPage() {
  const can = useCan();
  const canAnswer = can("admin.product_questions.answer");
  const { page, query, setQuery, run, errors, notice } = usePagedList(listQuestions, { status: "PENDING" });
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  return (
    <>
      <Guide section="qa" />
      <h1>{t("nav.questions")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <select value={query.status ?? ""} onChange={(e) => setQuery({ status: e.target.value || undefined })}>
          <option value="">{t("field.status")}: {t("common.all")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`questionStatus.${status}`)}
            </option>
          ))}
        </select>
      </div>
      {page?.results.length === 0 && <p className="card muted">{t("common.empty")}</p>}
      {page?.results.map((question) => (
        <div key={question.id} className="card">
          <div className="spread card-header">
            <div className="row">
              <strong>{question.product_name}</strong>
              <Label prefix="questionStatus" value={question.status} />
              {question.is_public && <span className="badge ok">{t("field.is_public")}</span>}
            </div>
            <span className="muted" dir="ltr">
              {question.user_mobile ?? t("common.none")}
            </span>
          </div>
          <p>{question.question_text}</p>
          {question.answer_text && <div className="muted" dangerouslySetInnerHTML={{ __html: question.answer_text }} />}
          {canAnswer && (
            <div className="row" style={{ marginTop: 12 }}>
              {question.status !== "REJECTED" && (
                <>
                  <textarea
                    className="grow"
                    placeholder={t("field.answer")}
                    value={drafts[question.id] ?? question.answer_text ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [question.id]: e.target.value })}
                  />
                  <button
                    className="primary"
                    onClick={() => run(() => answerQuestion(question.id, drafts[question.id] ?? question.answer_text ?? "", true))}
                  >
                    {t("action.answer")}
                  </button>
                </>
              )}
              {question.status === "PENDING" && (
                <button className="danger" onClick={() => run(() => questionAction(question.id, "reject"))}>
                  {t("action.reject")}
                </button>
              )}
              {question.status === "ANSWERED" && (
                <button onClick={() => run(() => questionAction(question.id, "toggle-public"))}>{t("action.togglePublic")}</button>
              )}
            </div>
          )}
        </div>
      ))}
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
