"use client";

import Link from "next/link";
import { useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { changeUserState, createUser, listUsers, setUserTier, updateUserNames } from "@/lib/api/commerce";
import type { AdminUser, CustomerTier } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

const EMPTY = { mobile: "", first_name: "", last_name: "", customer_tier: "RETAIL" as CustomerTier };

export default function UsersPage() {
  const can = useCan();
  const { page, query, setQuery, run, errors, notice } = usePagedList(listUsers);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<(typeof EMPTY & { id?: number }) | null>(null);

  const save = () =>
    form &&
    run(async () => {
      if (form.id) await updateUserNames(form.id, { first_name: form.first_name, last_name: form.last_name });
      else await createUser(form);
      setForm(null);
    });

  const edit = (user: AdminUser) =>
    setForm({ id: user.id, mobile: user.mobile, first_name: user.first_name, last_name: user.last_name, customer_tier: user.customer_tier });

  return (
    <>
      <Guide section="users" />
      <h1>{t("nav.users")}</h1>
      <Messages errors={errors} notice={notice} />
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ search: search || undefined });
        }}
      >
        <input placeholder={t("users.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit">{t("common.search")}</button>
        {can("admin.users.create") && !form && (
          <button type="button" className="primary" onClick={() => setForm({ ...EMPTY })}>
            {t("common.add")}
          </button>
        )}
      </form>
      {form && (
        <div className="card">
          <div className="form-grid">
            <label>
              <FieldLabel field="mobile">{t("field.mobile")}</FieldLabel>
              <input dir="ltr" disabled={Boolean(form.id)} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </label>
            <label>
              <FieldLabel field="first_name">{t("field.first_name")}</FieldLabel>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </label>
            <label>
              <FieldLabel field="last_name">{t("field.last_name")}</FieldLabel>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </label>
            {!form.id && (
              <label>
                <FieldLabel field="customer_tier">{t("field.customer_tier")}</FieldLabel>
                <select value={form.customer_tier} onChange={(e) => setForm({ ...form, customer_tier: e.target.value as CustomerTier })}>
                  <option value="RETAIL">{t("tier.RETAIL")}</option>
                  <option value="WHOLESALE">{t("tier.WHOLESALE")}</option>
                </select>
              </label>
            )}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={save}>
              {t("common.save")}
            </button>
            <button onClick={() => setForm(null)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("field.mobile")}</th>
              <th>{t("field.name")}</th>
              <th>{t("field.customer_tier")}</th>
              <th>{t("field.account_status")}</th>
              <th>{t("common.actions")}</th>
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
            {page?.results.map((user) => (
              <tr key={user.id}>
                <td dir="ltr">{user.mobile}</td>
                <td>{`${user.first_name} ${user.last_name}`.trim() || t("common.none")}</td>
                <td>
                  <Label prefix="tier" value={user.customer_tier} />
                </td>
                <td>
                  {user.account_status === "BLOCKED" ? (
                    <Label prefix="accountStatus" value="BLOCKED" tone="off" />
                  ) : (
                    <Label prefix="accountStatus" value="ACTIVE" tone={user.is_active ? "ok" : "off"} />
                  )}
                  {user.account_status === "ACTIVE" && !user.is_active && <span className="muted"> ({t("action.deactivate")})</span>}
                </td>
                <td>
                  <div className="row">
                    {can("admin.users.edit") && <button className="small" onClick={() => edit(user)}>{t("common.edit")}</button>}
                    {can("admin.users.tier") && (
                      <button
                        className="small"
                        onClick={() => run(() => setUserTier(user.id, user.customer_tier === "RETAIL" ? "WHOLESALE" : "RETAIL"))}
                      >
                        {t(user.customer_tier === "RETAIL" ? "tier.WHOLESALE" : "tier.RETAIL")}
                      </button>
                    )}
                    {can("admin.users.block") && user.is_active && (
                      <>
                        <button className="small" onClick={() => run(() => changeUserState(user.id, "deactivate"))}>
                          {t("action.deactivate")}
                        </button>
                        <button className="small danger" onClick={() => run(() => changeUserState(user.id, "block"))}>
                          {t("action.block")}
                        </button>
                      </>
                    )}
                    {can("admin.users.block") && !user.is_active && (
                      <button className="small" onClick={() => run(() => changeUserState(user.id, "reactivate"))}>
                        {t("action.reactivate")}
                      </button>
                    )}
                    {can("admin.orders.view_all") && (
                      <Link href={`/manage/orders?search=${user.mobile}`} className="muted">
                        {t("nav.orders")}
                      </Link>
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
