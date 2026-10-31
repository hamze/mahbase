"use client";

import { useState } from "react";

import { FieldLabel } from "@/components/InfoTip";
import { EMPTY_VARIANT } from "@/components/VariantFields";
import type { Attribute, AttributeValue, Variant } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";

export type GeneratedVariant = Variant & { enabled: boolean; label: string };

export const DEFAULT_ROWS: GeneratedVariant[] = [{ ...EMPTY_VARIANT, enabled: true, label: t("product.defaultVariant") }];

type Props = {
  attributes: Attribute[];
  rows: GeneratedVariant[];
  onRowsChange: (rows: GeneratedVariant[]) => void;
};

type EditableField =
  | "sku"
  | "base_price"
  | "wholesale_price"
  | "discount_percentage"
  | "stock_quantity"
  | "pack_size"
  | "purchase_step"
  | "min_purchase"
  | "max_purchase";

// Cleared nullable fields are sent as null; other cleared fields are omitted so the backend default applies.
const NULLABLE: EditableField[] = ["pack_size", "wholesale_price", "discount_percentage"];

function combinations(groups: AttributeValue[][]): AttributeValue[][] {
  return groups.reduce<AttributeValue[][]>(
    (result, group) => result.flatMap((combo) => group.map((value) => [...combo, value])),
    [[]],
  );
}

/** Rows for every combination of the chosen values; rows that still exist keep what was already typed. */
function buildRows(attributes: Attribute[], chosen: Record<number, string[]>, previous: GeneratedVariant[]): GeneratedVariant[] {
  const groups = attributes
    .filter((attribute) => chosen[attribute.id]?.length)
    .map((attribute) => chosen[attribute.id].map((value) => ({ attribute: attribute.id, attribute_name: attribute.name, value })));
  if (groups.length === 0) {
    return [previous.find((row) => row.attributes.length === 0) ?? DEFAULT_ROWS[0]];
  }
  return combinations(groups).map((combo) => {
    const label = combo.map((value) => `${value.attribute_name}: ${value.value}`).join(" / ");
    return previous.find((row) => row.label === label) ?? { ...EMPTY_VARIANT, attributes: combo, enabled: true, label };
  });
}

/**
 * Choose values of the variant-generating attributes; every combination becomes one clearly labelled table row
 * with its own SKU, price, stock and purchase limits.
 */
export function VariantGenerator({ attributes, rows, onRowsChange }: Props) {
  const can = useCan();
  const [chosen, setChosen] = useState<Record<number, string[]>>({});

  const choose = (attributeId: number, values: string[]) => {
    const next = { ...chosen, [attributeId]: values };
    setChosen(next);
    onRowsChange(buildRows(attributes, next, rows));
  };

  const updateRow = (index: number, name: keyof GeneratedVariant, value: unknown) =>
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [name]: value } : row)));

  const canPrice = can("products.edit_price");
  const columns: EditableField[] = [
    "sku",
    ...(canPrice ? (["base_price", "wholesale_price", "discount_percentage"] as const) : []),
    ...(can("products.edit_stock") ? (["stock_quantity"] as const) : []),
    "pack_size",
    "purchase_step",
    "min_purchase",
    "max_purchase",
  ];

  return (
    <>
      <div className="card">
        <h3 className="card-title">{t("product.variantAttributes")}</h3>
        {attributes.length === 0 ? (
          <p className="muted">{t("product.noGenerators")}</p>
        ) : (
          <>
            <p className="muted">{t("product.chooseValues")}</p>
            {attributes.map((attribute) => (
              <div key={attribute.id} className="attribute-values">
                <strong>{attribute.name}</strong>
                {attribute.type === "select" ? (
                  <div className="row">
                    {attribute.options
                      .filter((option) => option.is_active)
                      .map((option) => {
                        const values = chosen[attribute.id] ?? [];
                        const active = values.includes(option.value);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`pill${active ? " active" : ""}`}
                            aria-pressed={active}
                            onClick={() =>
                              choose(attribute.id, active ? values.filter((value) => value !== option.value) : [...values, option.value])
                            }
                          >
                            {option.value}
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <input
                    placeholder={t("product.valuesHint")}
                    onChange={(e) =>
                      choose(
                        attribute.id,
                        e.target.value.split(/[,،]/).map((value) => value.trim()).filter(Boolean),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">{t("product.variantTable")}</h3>
        <p className="muted">{t("product.variantTableHint")}</p>
        <div className="table-scroll">
          <table className="variant-table">
            <thead>
              <tr>
                <th>{t("product.enabled")}</th>
                <th>{t("product.variantColumn")}</th>
                {columns.map((name) => (
                  <th key={name}>
                    <FieldLabel field={name}>{t(`field.${name}` as MessageKey)}</FieldLabel>
                  </th>
                ))}
                {canPrice && (
                  <th>
                    <FieldLabel field="is_discount_active">{t("field.is_discount_active")}</FieldLabel>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.label} className={row.enabled ? undefined : "disabled-row"}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${t("product.enabled")}: ${row.label}`}
                      checked={row.enabled}
                      onChange={(e) => updateRow(index, "enabled", e.target.checked)}
                    />
                  </td>
                  <th scope="row" className="variant-label">
                    {row.attributes.length === 0 ? (
                      <span className="chip static">{row.label}</span>
                    ) : (
                      row.attributes.map((value) => (
                        <span key={value.attribute} className="chip static">
                          {value.attribute_name}: <strong>{value.value}</strong>
                        </span>
                      ))
                    )}
                  </th>
                  {columns.map((name) => (
                    <td key={name}>
                      <input
                        dir="ltr"
                        inputMode={name === "sku" ? undefined : "decimal"}
                        disabled={!row.enabled}
                        aria-label={`${t(`field.${name}` as MessageKey)} — ${row.label}`}
                        value={(row[name] as string | null | undefined) ?? ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            name,
                            e.target.value === "" && name !== "sku" ? (NULLABLE.includes(name) ? null : undefined) : e.target.value,
                          )
                        }
                      />
                    </td>
                  ))}
                  {canPrice && (
                    <td>
                      <input
                        type="checkbox"
                        disabled={!row.enabled}
                        aria-label={`${t("field.is_discount_active")} — ${row.label}`}
                        checked={Boolean(row.is_discount_active)}
                        onChange={(e) => updateRow(index, "is_discount_active", e.target.checked)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
