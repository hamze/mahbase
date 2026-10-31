"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { MultiSelect } from "@/components/MultiSelect";
import { CatalogResource, createItem, deleteItem, listAll, updateItem } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import type { Category } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";

type Row = { id: number } & Record<string, unknown>;
type Form = Record<string, unknown>;

export type FieldDef = {
  name: string;
  label: MessageKey;
  kind: "text" | "textarea" | "number" | "checkbox" | "parentCategory" | "categories" | "choice" | "image";
  choices?: { value: string; label: MessageKey }[];
  /** Tooltip key suffix (``help.<help>``) when it differs from the field name. */
  help?: string;
  /** "categories" fields: text shown while nothing is selected. */
  placeholder?: MessageKey;
};

export type ColumnDef = { label: MessageKey; render: (row: Row, lookup: CategoryLookup) => ReactNode };

type CategoryLookup = (id: number | null) => string;

type Props = {
  resource: CatalogResource;
  section: string;
  permission: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  emptyForm: Form;
  showExample?: boolean;
  /** Runs before create/update with the chosen image files (e.g. upload a temporary brand logo). */
  beforeSave?: (form: Form, files: Record<string, File>) => Promise<Form>;
  /** Runs after create/update (e.g. upload a category icon owned by the saved row). */
  afterSave?: (saved: Row, files: Record<string, File>) => Promise<void>;
  rowExtra?: (row: Row, reload: () => void) => ReactNode;
};

/** Generic list + form for catalog metadata with the section guide, RBAC-aware controls and deactivation feedback. */
export function ResourceManager(props: Props) {
  const { resource, section, permission, fields, columns, emptyForm } = props;
  const can = useCan();
  const canManage = can(permission);
  const needsCategories = fields.some((field) => field.kind === "parentCategory" || field.kind === "categories");

  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const reload = useCallback(async () => {
    setRows(await listAll<Row>(resource));
    if (needsCategories) setCategories(await listAll<Category>("categories"));
  }, [resource, needsCategories]);

  useEffect(() => {
    reload().catch((error) => setErrors(errorMessages(error)));
  }, [reload]);

  const lookup: CategoryLookup = (id) => categories.find((category) => category.id === id)?.name ?? t("common.none");

  const save = async () => {
    if (!form) return;
    setErrors([]);
    try {
      const payload = props.beforeSave ? await props.beforeSave(form, files) : form;
      const saved = (form.id
        ? await updateItem<Row>(resource, form.id as number, payload)
        : await createItem<Row>(resource, payload)) as Row;
      // Keep the saved row (with its id) and the chosen files, so retrying after a failed afterSave
      // upload updates this row instead of creating a duplicate.
      setForm({ ...saved });
      if (props.afterSave) await props.afterSave(saved, files);
      setForm(null);
      setFiles({});
      setNotice(t("common.saved"));
      await reload();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const remove = async (row: Row) => {
    setErrors([]);
    try {
      const result = await deleteItem(resource, row.id);
      setNotice(result?.deactivated ? t("common.deactivated") : t("common.deleted"));
      await reload();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const set = (name: string, value: unknown) => setForm((current) => ({ ...current, [name]: value }));

  const renderField = (field: FieldDef) => {
    const value = form?.[field.name];
    switch (field.kind) {
      case "checkbox":
        return (
          <label key={field.name} className="inline">
            <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(field.name, e.target.checked)} />
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
          </label>
        );
      case "textarea":
        return (
          <label key={field.name}>
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
            <textarea value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)} />
          </label>
        );
      case "parentCategory":
        return (
          <label key={field.name}>
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
            <select
              value={value ? String(value) : ""}
              onChange={(e) => set(field.name, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("common.none")}</option>
              {categories
                .filter((category) => category.parent === null && category.id !== form?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
        );
      case "categories":
        // A div, not a label: the multi-select contains its own buttons and search input.
        return (
          <div key={field.name} className="field">
            <FieldLabel field={field.help ?? field.name}>{t(field.label)}</FieldLabel>
            <MultiSelect
              placeholder={field.placeholder && t(field.placeholder)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.parent ? `${lookup(category.parent)} › ${category.name}` : category.name,
              }))}
              value={(value as number[]) ?? []}
              onChange={(ids) => set(field.name, ids)}
            />
          </div>
        );
      case "choice":
        return (
          <label key={field.name}>
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
            <select value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)}>
              {field.choices?.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {t(choice.label)}
                </option>
              ))}
            </select>
          </label>
        );
      case "image":
        return (
          <label key={field.name}>
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setFiles((current) => ({ ...current, [field.name]: file }));
              }}
            />
          </label>
        );
      default:
        return (
          <label key={field.name}>
            <FieldLabel field={field.name}>{t(field.label)}</FieldLabel>
            <input
              type={field.kind === "number" ? "number" : "text"}
              dir={field.name === "slug" ? "ltr" : undefined}
              value={String(value ?? "")}
              onChange={(e) => set(field.name, field.kind === "number" ? Number(e.target.value) : e.target.value)}
            />
          </label>
        );
    }
  };

  return (
    <>
      <Guide section={section} example={props.showExample} />
      <Messages errors={errors} notice={notice} />
      {canManage && !form && (
        <button className="primary" onClick={() => setForm({ ...emptyForm })}>
          {t("common.add")}
        </button>
      )}
      {form && (
        <div className="card">
          <div className="form-grid">{fields.map(renderField)}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={save}>
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
              {columns.map((column) => (
                <th key={column.label}>{t(column.label)}</th>
              ))}
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.label}>{column.render(row, lookup)}</td>
                ))}
                <td>
                  {canManage && (
                    <div className="row">
                      <button onClick={() => setForm({ ...row })}>{t("common.edit")}</button>
                      <button className="danger" onClick={() => remove(row)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                  {props.rowExtra?.(row, reload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Brands and tags without categories apply to all categories. */
export function categoryList(ids: number[], lookup: CategoryLookup) {
  return ids.length ? ids.map(lookup).join("، ") : <span className="badge">{t("common.allCategoriesShort")}</span>;
}

export function ActiveBadge({ active }: { active: unknown }) {
  return <span className={`badge ${active ? "ok" : "off"}`}>{active ? t("common.yes") : t("common.no")}</span>;
}
