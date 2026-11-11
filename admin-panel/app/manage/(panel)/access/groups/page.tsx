"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { createGroup, deleteGroup, listGroups } from "@/lib/api/access";
import { errorMessages } from "@/lib/api/errors";
import type { AccessGroup } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";

type NewGroup = { name: string; slug: string; description_fa: string };

/** Latin-only slug suggestion; a Persian name leaves the slug for the admin to type. */
function suggestSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function GroupsPage() {
  const can = useCan();
  const canManage = can("access.manage_groups");
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [form, setForm] = useState<NewGroup | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const reload = useCallback(async () => setGroups(await listGroups()), []);

  useEffect(() => {
    reload().catch((error) => setErrors(errorMessages(error)));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setErrors([]);
    try {
      await action();
      setNotice(success);
      await reload();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return (
    <>
      <Guide section="access.groups" />
      <h1>{t("nav.accessGroups")}</h1>
      <Messages errors={errors} notice={notice} />
      {canManage && !form && (
        <button className="primary" onClick={() => setForm({ name: "", slug: "", description_fa: "" })}>
          {t("access.createGroup")}
        </button>
      )}
      {form && (
        <div className="card">
          <div className="form-grid">
            <label>
              <FieldLabel field="name">{t("field.name")}</FieldLabel>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: form.slug === suggestSlug(form.name) ? suggestSlug(e.target.value) : form.slug,
                  })
                }
              />
            </label>
            <label>
              <FieldLabel field="slug">{t("field.slug")}</FieldLabel>
              <input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label>
              <FieldLabel field="description">{t("field.description")}</FieldLabel>
              <textarea value={form.description_fa} onChange={(e) => setForm({ ...form, description_fa: e.target.value })} />
            </label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="primary"
              onClick={() => run(async () => { await createGroup(form); setForm(null); }, t("common.saved"))}
            >
              {t("common.save")}
            </button>
            <button onClick={() => setForm(null)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("field.name")}</th>
              <th>{t("field.slug")}</th>
              <th>{t("access.userCount")}</th>
              <th>{t("access.permissionCount")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {groups.map((group) => (
              <tr key={group.id}>
                <td>
                  <div className="row">
                    {group.name}
                    {group.is_system && <span className="badge">{t("access.system")}</span>}
                  </div>
                </td>
                <td dir="ltr">{group.slug}</td>
                <td>{group.user_count}</td>
                <td>{group.permission_count}</td>
                <td>
                  <div className="row">
                    <Link className="button" href={`/manage/access/groups/${group.id}`}>
                      {canManage ? t("common.edit") : t("access.view")}
                    </Link>
                    {canManage && (
                      <button
                        className="danger"
                        disabled={group.is_system}
                        onClick={() => run(() => deleteGroup(group.id), t("common.deleted"))}
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
