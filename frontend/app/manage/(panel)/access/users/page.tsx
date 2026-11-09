"use client";

import { useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { listAccessUsers, listGroups, setAccessUserGroup, toggleAccessUserActive } from "@/lib/api/access";
import { errorMessages } from "@/lib/api/errors";
import type { AccessGroup } from "@/lib/api/types";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

/** Staff accounts: assign a group and (de)activate. Passwords are managed outside this page. */
export default function AccessUsersPage() {
  const { page, query, setQuery, run, errors, notice } = usePagedList(listAccessUsers);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    listGroups().then(setGroups).catch((error) => setLoadErrors(errorMessages(error)));
  }, []);

  return (
    <>
      <Guide section="access.users" />
      <h1>{t("nav.accessUsers")}</h1>
      <Messages errors={[...loadErrors, ...errors]} notice={notice} />
      <div className="card row">
        <input
          className="grow"
          placeholder={t("common.search")}
          value={query.search ?? ""}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: undefined })}
        />
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("access.username")}</th>
              <th>{t("access.fullName")}</th>
              <th>{t("field.mobile")}</th>
              <th>{t("access.group")}</th>
              <th>{t("field.is_active")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {page?.results.map((user) => (
              <tr key={user.id}>
                <td dir="ltr">
                  {user.username} {user.is_superuser && <span className="badge ok">{t("access.superuser")}</span>}
                </td>
                <td>{user.full_name || t("common.none")}</td>
                <td dir="ltr">{user.mobile ?? t("common.none")}</td>
                <td>
                  <select
                    value={user.group ?? ""}
                    onChange={(e) => run(() => setAccessUserGroup(user.id, e.target.value ? Number(e.target.value) : null))}
                  >
                    <option value="">{t("access.noGroup")}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? "ok" : "off"}`}>
                    {user.is_active ? t("common.yes") : t("common.no")}
                  </span>
                </td>
                <td>
                  <button onClick={() => run(() => toggleAccessUserActive(user.id))}>
                    {user.is_active ? t("access.deactivate") : t("access.activate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
