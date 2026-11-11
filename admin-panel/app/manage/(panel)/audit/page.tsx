"use client";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listAudit } from "@/lib/api/commerce";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

export default function AuditPage() {
  const { page, query, setQuery, errors } = usePagedList(listAudit);

  return (
    <>
      <Guide section="audit" />
      <h1>{t("nav.audit")}</h1>
      <Messages errors={errors} />
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("field.created_at")}</th>
              <th>{t("field.actor")}</th>
              <th>{t("field.action")}</th>
              <th>{t("field.target")}</th>
              <th>{t("field.value")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {page?.results.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString("fa-IR")}</td>
                <td dir="ltr">{entry.actor_username ?? t("common.none")}</td>
                <td dir="ltr">{entry.action}</td>
                <td dir="ltr">{`${entry.target_type}#${entry.target_id}`}</td>
                <td dir="ltr">
                  <code>{JSON.stringify(entry.data)}</code>
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
