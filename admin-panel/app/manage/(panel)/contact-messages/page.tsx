"use client";

import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listContactMessages, setContactMessageStatus } from "@/lib/api/site";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

const STATUSES = ["NEW", "READ", "REPLIED"] as const;

/** Contact-form inbox. NEW → READ → REPLIED; reopening a replied message needs a note. */
export default function ContactMessagesPage() {
  const can = useCan();
  const canManage = can("contact_messages.manage");
  const { page, query, setQuery, run, errors, notice } = usePagedList(listContactMessages);
  const [notes, setNotes] = useState<Record<number, string>>({});

  return (
    <>
      <Guide section="contactMessages" />
      <h1>{t("nav.contactMessages")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <select value={query.status ?? ""} onChange={(e) => setQuery({ status: e.target.value || undefined })}>
          <option value="">{t("field.status")}: {t("common.all")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{t(`contactStatus.${status}`)}</option>
          ))}
        </select>
      </div>
      {page?.results.length === 0 && <p className="card muted">{t("common.empty")}</p>}
      {page?.results.map((message) => (
        <div key={message.id} className="card">
          <div className="spread card-header">
            <div className="row">
              <strong>{message.subject}</strong>
              <Label prefix="contactStatus" value={message.status} tone={message.status === "REPLIED" ? "ok" : undefined} />
            </div>
            <span className="muted" dir="ltr">
              {message.name} · {message.mobile} {message.email ? `· ${message.email}` : ""} ·{" "}
              {new Date(message.created_at).toLocaleString("fa-IR")}
            </span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{message.message}</p>
          {message.note && <p className="muted">{t("field.note")}: {message.note}</p>}
          {canManage && (
            <div className="row">
              {message.status === "NEW" && (
                <button onClick={() => run(() => setContactMessageStatus(message.id, "READ"))}>{t("contact.markRead")}</button>
              )}
              {message.status !== "REPLIED" && (
                <button className="primary" onClick={() => run(() => setContactMessageStatus(message.id, "REPLIED"))}>
                  {t("contact.markReplied")}
                </button>
              )}
              {message.status === "REPLIED" && (
                <>
                  <input
                    className="grow"
                    placeholder={t("field.note")}
                    value={notes[message.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [message.id]: e.target.value })}
                  />
                  <button
                    disabled={!notes[message.id]?.trim()}
                    onClick={() => run(() => setContactMessageStatus(message.id, "READ", notes[message.id]))}
                  >
                    {t("contact.reopen")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
