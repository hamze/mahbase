"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { ApiError } from "@/lib/api/client";
import { errorMessages } from "@/lib/api/errors";
import { getProduct, listProducts, PriceChange, updateStock, updateVariantPrice } from "@/lib/api/products";
import type { Product, StockBelowReserved, Variant } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";
import { finalPrice, formatNumber, plainNumber } from "@/lib/pricing";
import { variantLabel } from "@/lib/variants";

type Draft = Required<PriceChange> & { stock_quantity: string };

const PRICE_INPUTS = ["base_price", "wholesale_price", "discount_percentage"] as const;

// Decimal strings from the API ("36000.00") are edited without the trailing zeros.
function toDraft(variant: Variant): Draft {
  return {
    stock_quantity: plainNumber(variant.stock_quantity ?? "0"),
    base_price: plainNumber(variant.base_price ?? "0"),
    wholesale_price: variant.wholesale_price == null ? null : plainNumber(variant.wholesale_price),
    discount_percentage: variant.discount_percentage == null ? null : plainNumber(variant.discount_percentage),
    is_discount_active: Boolean(variant.is_discount_active),
  };
}

const stockChanged = (draft: Draft, variant: Variant) => draft.stock_quantity !== toDraft(variant).stock_quantity;

const priceChanged = (draft: Draft, variant: Variant) => {
  const saved = toDraft(variant);
  return (["base_price", "wholesale_price", "discount_percentage", "is_discount_active"] as const).some(
    (name) => draft[name] !== saved[name],
  );
};

/** Search a product, then edit stock (absolute value, locked on the backend) and prices of all its variants in one table. */
export function StockManager({ initialSlug }: { initialSlug?: string }) {
  const can = useCan();
  const canStock = can("products.edit_stock");
  const canPrice = can("products.edit_price");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);

  const open = useCallback(async (slug: string) => {
    const loaded = await getProduct(slug);
    setProduct(loaded);
    setDrafts(Object.fromEntries(loaded.variants.map((variant) => [variant.id!, toDraft(variant)])));
  }, []);

  useEffect(() => {
    if (initialSlug) open(initialSlug).catch((error) => setErrors(errorMessages(error)));
  }, [initialSlug, open]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setErrors([]);
    try {
      setResults((await listProducts({ search: query })).results);
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const dirty = (variant: Variant) => {
    const draft = drafts[variant.id!];
    return stockChanged(draft, variant) || priceChanged(draft, variant);
  };

  const saveStock = async (variantId: number, stock_quantity: string) => {
    try {
      await updateStock(variantId, { stock_quantity });
    } catch (error) {
      const data = error instanceof ApiError ? (error.data as StockBelowReserved | null) : null;
      if (data?.warning !== "stock_below_reserved") throw error;
      const message = t("stock.belowReservedConfirm", {
        requested: formatNumber(plainNumber(data.requested)),
        reserved: formatNumber(plainNumber(data.reserved_quantity)),
        shortfall: formatNumber(plainNumber(data.shortfall)),
        orders: data.affected_orders.map((order) => order.order_number).join("، "),
      });
      // Declining leaves the stock unchanged; the row stays dirty.
      if (window.confirm(message)) await updateStock(variantId, { stock_quantity, confirm: true });
    }
  };

  const save = async (variants: Variant[]) => {
    if (!product) return;
    setSaving(true);
    setErrors([]);
    setNotice(undefined);
    const failures: string[] = [];
    for (const variant of variants) {
      const draft = drafts[variant.id!];
      try {
        if (canStock && stockChanged(draft, variant)) {
          await saveStock(variant.id!, draft.stock_quantity);
        }
        if (canPrice && priceChanged(draft, variant)) {
          const { stock_quantity: _stock, ...prices } = draft;
          await updateVariantPrice(variant.id!, prices);
        }
      } catch (error) {
        failures.push(...errorMessages(error).map((message) => `${variant.sku}: ${message}`));
      }
    }
    try {
      await open(product.slug);
    } catch (error) {
      failures.push(...errorMessages(error));
    }
    setErrors(failures);
    if (!failures.length) setNotice(t("common.saved"));
    setSaving(false);
  };

  const setDraft = (id: number, change: Partial<Draft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  const changed = product?.variants.filter(dirty) ?? [];

  return (
    <>
      <Guide section="stock" />
      <form className="card row" onSubmit={search}>
        <input
          className="grow"
          placeholder={t("stock.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="primary">
          {t("common.search")}
        </button>
      </form>
      {results && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t("field.name")}</th>
                <th>{t("field.category")}</th>
                <th>{t("product.variants")}</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
              {results.map((item) => (
                <tr
                  key={item.id}
                  className={`clickable${product?.id === item.id ? " selected" : ""}`}
                  onClick={() => open(item.slug).catch((error) => setErrors(errorMessages(error)))}
                >
                  <td>{item.name}</td>
                  <td>{item.category_name}</td>
                  <td>{formatNumber(item.variants.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Messages errors={errors} notice={notice} />
      {!product && !results && <p className="muted">{t("stock.selectProduct")}</p>}
      {product && (
        <div className="card">
          <div className="spread card-header">
            <h3 className="card-title">{product.name}</h3>
            <div className="row">
              <Link className="button" href={`/manage/products/${encodeURIComponent(product.slug)}`}>
                {t("stock.openProduct")}
              </Link>
              <button className="primary" disabled={saving || changed.length === 0} onClick={() => save(changed)}>
                {t("stock.saveAll", { count: formatNumber(changed.length) })}
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="variant-table">
              <thead>
                <tr>
                  <th>{t("product.variantColumn")}</th>
                  <th>
                    <FieldLabel field="sku">{t("field.sku")}</FieldLabel>
                  </th>
                  <th>
                    <FieldLabel field="stock_quantity">{`${t("field.stock_quantity")} (${product.unit_name})`}</FieldLabel>
                  </th>
                  {PRICE_INPUTS.map((name) => (
                    <th key={name}>
                      <FieldLabel field={name}>{t(`field.${name}` as MessageKey)}</FieldLabel>
                    </th>
                  ))}
                  <th>
                    <FieldLabel field="is_discount_active">{t("field.is_discount_active")}</FieldLabel>
                  </th>
                  <th>{t("field.final_price")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => {
                  const draft = drafts[variant.id!];
                  const label = variantLabel(variant);
                  return (
                    <tr key={variant.id} className={dirty(variant) ? "dirty-row" : undefined}>
                      <th scope="row" className="variant-label">
                        <span className="chip static">{label}</span>
                      </th>
                      <td dir="ltr">{variant.sku}</td>
                      <td>
                        <input
                          dir="ltr"
                          inputMode="decimal"
                          disabled={!canStock}
                          aria-label={`${t("field.stock_quantity")} — ${label}`}
                          value={draft.stock_quantity}
                          onChange={(e) => setDraft(variant.id!, { stock_quantity: e.target.value })}
                        />
                        {Number(variant.reserved_quantity) > 0 && (
                          <span className="muted">
                            {t("field.reserved_quantity")}: {formatNumber(plainNumber(variant.reserved_quantity!))}
                          </span>
                        )}
                      </td>
                      {PRICE_INPUTS.map((name) => (
                        <td key={name}>
                          <input
                            dir="ltr"
                            inputMode="decimal"
                            disabled={!canPrice}
                            aria-label={`${t(`field.${name}` as MessageKey)} — ${label}`}
                            value={draft[name] ?? ""}
                            onChange={(e) =>
                              setDraft(variant.id!, {
                                // base_price is required; the other price fields are cleared to null.
                                [name]: e.target.value === "" && name !== "base_price" ? null : e.target.value,
                              })
                            }
                          />
                        </td>
                      ))}
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canPrice}
                          aria-label={`${t("field.is_discount_active")} — ${label}`}
                          checked={draft.is_discount_active}
                          onChange={(e) => setDraft(variant.id!, { is_discount_active: e.target.checked })}
                        />
                      </td>
                      <td>{formatNumber(finalPrice(draft.base_price, draft.discount_percentage, draft.is_discount_active))}</td>
                      <td>
                        <button disabled={saving || !dirty(variant)} onClick={() => save([variant])}>
                          {t("common.save")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
