"use client";

import { Fragment, useState } from "react";

import { Guide } from "@/components/Guide";
import { dateToYmd, JalaliDatePicker, ymdToDate } from "@/components/JalaliDatePicker";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listNotifications, setNotificationStatus } from "@/lib/api/site";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

const TYPES = ["SYSTEM", "ORDER", "REVIEW", "CONTACT", "ACCOUNT"] as const;
const STATUSES = ["NEW", "READ", "ARCHIVED"] as const;

export default function NotificationsPage() {
  const can = useCan();
  const { page, query, setQuery, run, errors, notice } = usePagedList(listNotifications);
  const [open, setOpen] = useState<number | null>(null);
  const filter = (name: string, value: string) => setQuery({ ...query, [name]: value || undefined, page: undefined });

  return (
    <>
      <Guide section="notifications" />
      <h1>{t("nav.notifications")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <select value={query.type ?? ""} onChange={(e) => filter("type", e.target.value)}>
          <option value="">{t("field.type")}: {t("common.all")}</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>{t(`notificationType.${type}`)}</option>
          ))}
        </select>
        <select value={query.status ?? ""} onChange={(e) => filter("status", e.target.value)}>
          <option value="">{t("field.status")}: {t("notifications.notArchived")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{t(`notificationStatus.${status}`)}</option>
          ))}
        </select>
        <input placeholder={t("notifications.userId")} dir="ltr" value={query.user ?? ""} onChange={(e) => filter("user", e.target.value)} />
        <JalaliDatePicker
          placeholder={t("date.from")}
          value={ymdToDate(query.date_from)}
          onChange={(date) => filter("date_from", dateToYmd(date) ?? "")}
        />
        <JalaliDatePicker
          placeholder={t("date.to")}
          value={ymdToDate(query.date_to)}
          onChange={(date) => filter("date_to", dateToYmd(date) ?? "")}
        />
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("field.title")}</th>
              <th>{t("field.type")}</th>
              <th>{t("field.channel")}</th>
              <th>{t("common.user")}</th>
              <th>{t("field.status")}</th>
              <th>{t("notifications.createdAt")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {page?.results.map((item) => (
              <Fragment key={item.id}>
                <tr className="clickable" onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <td>{item.title}</td>
                  <td><Label prefix="notificationType" value={item.type} /></td>
                  <td><Label prefix="notificationChannel" value={item.channel} /></td>
                  <td dir="ltr">{item.user_mobile ?? t("notifications.systemWide")}</td>
                  <td><Label prefix="notificationStatus" value={item.status} /></td>
                  <td dir="ltr">{new Date(item.created_at).toLocaleString("fa-IR")}</td>
                </tr>
                {open === item.id && (
                  <tr>
                    <td colSpan={6}>
                      <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
                      {item.related_object_type && (
                        <p className="muted" dir="ltr">
                          {item.related_object_type} #{item.related_object_id}
                        </p>
                      )}
                      {can("notifications.manage") && (
                        <div className="row">
                          {item.status === "NEW" && (
                            <button onClick={() => run(() => setNotificationStatus(item.id, "READ"))}>{t("notifications.markRead")}</button>
                          )}
                          {item.status !== "ARCHIVED" && (
                            <button onClick={() => run(() => setNotificationStatus(item.id, "ARCHIVED"))}>{t("notifications.archive")}</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
