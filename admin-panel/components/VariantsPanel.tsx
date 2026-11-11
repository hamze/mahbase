"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { EMPTY_VARIANT, VariantFields } from "@/components/VariantFields";
import { errorMessages } from "@/lib/api/errors";
import { addVariant, updateVariant } from "@/lib/api/products";
import type { Attribute, Product, Variant } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";
import { variantLabel } from "@/lib/variants";

type Props = { product: Product; generators: Attribute[] };

// Stock and prices are omitted so saving here never overwrites values changed on the Stock & Price page.
function withoutStockAndPrice({
  stock_quantity: _stock,
  base_price: _base,
  wholesale_price: _wholesale,
  discount_percentage: _discount,
  is_discount_active: _active,
  ...variant
}: Variant): Variant {
  return variant;
}

/** Existing variants: edit fields and attributes (atomic hash update on the backend) and add variants.
 * Stock changes live on the Stock & Price page. */
export function VariantsPanel({ product, generators }: Props) {
  const router = useRouter();
  const can = useCan();
  const [drafts, setDrafts] = useState<Variant[]>(product.variants);
  const [newVariant, setNewVariant] = useState<Variant | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const run = async (action: () => Promise<unknown>) => {
    setErrors([]);
    try {
      await action();
      setNotice(t("common.saved"));
      router.refresh();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const attributeInputs = (variant: Variant, onChange: (variant: Variant) => void) => (
    <div className="form-grid" style={{ marginBottom: 12 }}>
      {generators.map((attribute) => {
        const current = variant.attributes.find((item) => item.attribute === attribute.id)?.value ?? "";
        const setValue = (value: string) =>
          onChange({
            ...variant,
            attributes: [
              ...variant.attributes.filter((item) => item.attribute !== attribute.id),
              ...(value ? [{ attribute: attribute.id, value }] : []),
            ],
          });
        return (
          <label key={attribute.id}>
            {attribute.name}
            {attribute.type === "select" ? (
              <select value={current} onChange={(e) => setValue(e.target.value)}>
                <option value="">{t("common.none")}</option>
                {attribute.options
                  .filter((option) => option.is_active || option.value === current)
                  .map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.value}
                    </option>
                  ))}
              </select>
            ) : (
              <input value={current} onChange={(e) => setValue(e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );

  const canEdit = can("products.edit");

  return (
    <section>
      <Guide section="variants" />
      <div className="card spread">
        <span className="muted">{t("product.stockManagedElsewhere")}</span>
        {(can("products.edit_stock") || can("products.edit_price")) && (
          <Link className="button" href={`/manage/stock?product=${encodeURIComponent(product.slug)}`}>
            {t("product.manageStock")}
          </Link>
        )}
      </div>
      <Messages errors={errors} notice={notice} />
      {drafts.map((variant, index) => {
        const setDraft = (next: Variant) => setDrafts((current) => current.map((item, i) => (i === index ? next : item)));
        return (
          <div key={variant.id} className="card">
            <div className="spread card-header">
              <h3 className="card-title">
                {variantLabel(product.variants[index])} <span className="muted" dir="ltr">{variant.sku}</span>
              </h3>
              <span className="badge">
                {t("field.stock_quantity")}: {formatNumber(variant.stock_quantity ?? 0)} {product.unit_name}
              </span>
            </div>
            {/* Variant fields are saved through products.edit; other users see them read-only. */}
            <fieldset disabled={!canEdit}>
              {attributeInputs(variant, setDraft)}
              <VariantFields variant={variant} unitName={product.unit_name} creating={false} onChange={setDraft} />
            </fieldset>
            {canEdit && (
              <div className="form-actions">
                <button className="primary" onClick={() => run(() => updateVariant(product.id, variant.id!, withoutStockAndPrice(variant)))}>
                  {t("common.save")}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {canEdit && !newVariant && (
        <button onClick={() => setNewVariant({ ...EMPTY_VARIANT })}>{t("product.addVariant")}</button>
      )}
      {newVariant && (
        <div className="card">
          <h3 className="card-title">{t("product.addVariant")}</h3>
          {attributeInputs(newVariant, setNewVariant)}
          <VariantFields variant={newVariant} unitName={product.unit_name} creating onChange={setNewVariant} />
          <div className="form-actions">
            <button
              className="primary"
              onClick={() =>
                run(async () => {
                  await addVariant(product.id, newVariant);
                  setNewVariant(null);
                })
              }
            >
              {t("common.save")}
            </button>
            <button onClick={() => setNewVariant(null)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
