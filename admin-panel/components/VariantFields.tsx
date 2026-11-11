"use client";

import { FieldLabel } from "@/components/InfoTip";
import type { Variant } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";
import { finalPrice, formatNumber } from "@/lib/pricing";

type Props = {
  variant: Variant;
  onChange: (variant: Variant) => void;
  unitName: string;
  /** Stock and prices are entered only when a variant is created; afterwards on the Stock & Price page. */
  creating: boolean;
};

const QUANTITY_FIELDS = ["pack_size", "purchase_step", "min_purchase", "max_purchase"] as const;
const NULLABLE_FIELDS: (keyof Variant)[] = ["pack_size", "wholesale_price", "discount_percentage"];

// Cleared nullable fields are sent as null; other cleared fields are omitted so the backend default applies.
const emptyValue = (name: keyof Variant) => (NULLABLE_FIELDS.includes(name) ? null : undefined);

/** SKU and quantity limits of one variant, plus (on creation, permission-dependent) stock and pricing inputs. */
export function VariantFields({ variant, onChange, unitName, creating }: Props) {
  const can = useCan();
  const set = (name: keyof Variant, value: unknown) => onChange({ ...variant, [name]: value });
  const decimalInput = (name: keyof Variant) => (
    <label key={name}>
      <FieldLabel field={name}>{t(`field.${name}` as MessageKey)}</FieldLabel>
      <input
        dir="ltr"
        inputMode="decimal"
        value={(variant[name] as string | null | undefined) ?? ""}
        onChange={(e) => set(name, e.target.value === "" ? emptyValue(name) : e.target.value)}
      />
    </label>
  );

  return (
    <div className="form-grid">
      <label>
        <FieldLabel field="sku">{t("field.sku")}</FieldLabel>
        <input dir="ltr" value={variant.sku} onChange={(e) => set("sku", e.target.value)} />
      </label>
      {QUANTITY_FIELDS.map(decimalInput)}
      {creating && can("products.edit_stock") && decimalInput("stock_quantity")}
      {variant.pack_size && variant.stock_quantity && (
        <p className="muted">
          {t("product.packDisplay", {
            count: formatNumber(variant.stock_quantity),
            amount: formatNumber(Number(variant.stock_quantity) * Number(variant.pack_size)),
            unit: unitName,
          })}
        </p>
      )}
      {creating && can("products.edit_price") && (
        <>
          {decimalInput("base_price")}
          {decimalInput("wholesale_price")}
          {decimalInput("discount_percentage")}
          <label className="inline">
            <input
              type="checkbox"
              checked={Boolean(variant.is_discount_active)}
              onChange={(e) => set("is_discount_active", e.target.checked)}
            />
            <FieldLabel field="is_discount_active">{t("field.is_discount_active")}</FieldLabel>
          </label>
          <PriceSummary variant={variant} />
        </>
      )}
    </div>
  );
}

export function PriceSummary({ variant }: { variant: Variant }) {
  const discounted = Boolean(variant.is_discount_active && Number(variant.discount_percentage) > 0);
  return (
    <div>
      <div>
        {t("field.final_price")}:{" "}
        {discounted && <span className="strike">{formatNumber(variant.base_price ?? 0)}</span>}{" "}
        <strong>{formatNumber(finalPrice(variant.base_price, variant.discount_percentage, variant.is_discount_active))}</strong>{" "}
        {discounted && <span className="badge ok">{t("product.discountBadge", { percent: formatNumber(variant.discount_percentage ?? 0) })}</span>}
      </div>
      <div className="muted">
        {t("field.final_wholesale_price")}:{" "}
        {formatNumber(
          finalPrice(variant.wholesale_price || variant.base_price, variant.discount_percentage, variant.is_discount_active),
        )}
      </div>
    </div>
  );
}

export const EMPTY_VARIANT: Variant = {
  sku: "",
  attributes: [],
  pack_size: null,
  purchase_step: "1",
  min_purchase: "1",
  max_purchase: "10",
};
