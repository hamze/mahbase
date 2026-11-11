"use client";

import { use, useEffect, useMemo, useState } from "react";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { getGroup, listPermissions, updateGroup } from "@/lib/api/access";
import { errorMessages } from "@/lib/api/errors";
import type { AccessGroup, AccessPermission } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";

/** ``<prefix>.view`` for any other code of the same prefix ("blog.create" → "blog.view"). */
function viewCodeFor(code: string): string {
  return `${code.slice(0, code.lastIndexOf("."))}.view`;
}

/** Module header checkbox: checked, unchecked or indeterminate (some permissions of the module). */
function ModuleCheckbox({ state, disabled, onChange }: { state: "all" | "some" | "none"; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <input
      type="checkbox"
      ref={(element) => {
        if (element) element.indeterminate = state === "some";
      }}
      checked={state === "all"}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const canManage = can("access.manage_groups");
  const [group, setGroup] = useState<AccessGroup | null>(null);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    Promise.all([getGroup(Number(id)), listPermissions()])
      .then(([loadedGroup, loadedPermissions]) => {
        setGroup(loadedGroup);
        setSelected(new Set(loadedGroup.permissions));
        setPermissions(loadedPermissions.filter((permission) => permission.is_active));
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, [id]);

  const modules = useMemo(() => {
    const byModule = new Map<string, AccessPermission[]>();
    permissions.forEach((permission) => byModule.set(permission.module, [...(byModule.get(permission.module) ?? []), permission]));
    return [...byModule.entries()];
  }, [permissions]);
  const codes = useMemo(() => new Set(permissions.map((permission) => permission.code)), [permissions]);

  const toggle = (codesToChange: string[], checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      codesToChange.forEach((code) => {
        if (!checked) return next.delete(code);
        next.add(code);
        // Granting a write permission also grants the matching read permission (strict codes on the server).
        if (codes.has(viewCodeFor(code))) next.add(viewCodeFor(code));
      });
      return next;
    });

  const save = async () => {
    if (!group) return;
    setErrors([]);
    try {
      const saved = await updateGroup(group.id, {
        name: group.name,
        slug: group.slug,
        description_fa: group.description_fa,
        permissions: [...selected],
      });
      setGroup(saved);
      setSelected(new Set(saved.permissions));
      setNotice(t("common.saved"));
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return (
    <>
      <Guide section="access.groups" />
      {group && (
        <>
          <h1>{group.name}</h1>
          {group.description_fa && <p className="muted">{group.description_fa}</p>}
        </>
      )}
      <Messages errors={errors} notice={notice} />
      <div className="module-grid">
        {modules.map(([module, modulePermissions]) => {
          const count = modulePermissions.filter((permission) => selected.has(permission.code)).length;
          const state = count === 0 ? "none" : count === modulePermissions.length ? "all" : "some";
          return (
            <details key={module} className="card" open>
              <summary className="row">
                <ModuleCheckbox
                  state={state}
                  disabled={!canManage}
                  onChange={(checked) => toggle(modulePermissions.map((permission) => permission.code), checked)}
                />
                <strong dir="ltr">{module}</strong>
                <span className="muted">
                  {count}/{modulePermissions.length}
                </span>
              </summary>
              <div className="permission-list">
                {modulePermissions.map((permission) => (
                  <label key={permission.code} className="inline">
                    <input
                      type="checkbox"
                      checked={selected.has(permission.code)}
                      disabled={!canManage}
                      onChange={(e) => toggle([permission.code], e.target.checked)}
                    />
                    <span className="permission-text">
                      {permission.label_fa}
                      <span className="muted" dir="ltr">
                        {permission.code}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      {canManage && group && (
        <button className="primary" onClick={save}>
          {t("common.save")}
        </button>
      )}
    </>
  );
}
