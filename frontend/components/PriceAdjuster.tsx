"use client";

import { FormEvent, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { listAll } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import { adjustPrices } from "@/lib/api/products";
import type { Category } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

/** Site-wide (or per-category) percentage price change for inflation updates. */
export function PriceAdjuster() {
  const can = useCan();
  const [categories, setCategories] = useState<Category[]>([]);
  const [percentage, setPercentage] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAll<Category>("categories").then(setCategories).catch((error) => setErrors(errorMessages(error)));
  }, []);

  const percent = Number(percentage);
  const valid = percentage.trim() !== "" && Number.isFinite(percent) && percent !== 0 && percent > -100;
  const scope = category ? (categories.find((item) => item.id === category)?.name ?? "") : t("pricing.allProducts");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    setNotice(undefined);
    try {
      const result = await adjustPrices(percentage, category);
      setNotice(t("pricing.done", { count: formatNumber(result.updated) }));
      setPercentage("");
      setConfirmed(false);
    } catch (error) {
      setErrors(errorMessages(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Guide section="pricing.bulk" example />
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <label>
            <FieldLabel field="percentage">{t("pricing.percentage")}</FieldLabel>
            <input
              dir="ltr"
              inputMode="decimal"
              placeholder="+10 / -5"
              value={percentage}
              onChange={(e) => {
                setPercentage(e.target.value.replace("+", ""));
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            {t("pricing.scope")}
            <select
              value={category ?? ""}
              onChange={(e) => {
                setCategory(e.target.value ? Number(e.target.value) : null);
                setConfirmed(false);
              }}
            >
              <option value="">{t("pricing.allProducts")}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.parent ? `${categories.find((parent) => parent.id === item.parent)?.name} › ` : ""}
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {valid && (
          <>
            <p className="muted">{t("pricing.preview", { price: formatNumber(Math.round(100000 * (1 + percent / 100))) })}</p>
            <label className="inline confirm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              {t("pricing.confirm", { scope, percent: `${percent > 0 ? "+" : ""}${formatNumber(percent)}` })}
            </label>
          </>
        )}
        <Messages errors={errors} notice={notice} />
        {can("products.edit_price") && (
          <div className="form-actions">
            <button className="primary" type="submit" disabled={!valid || !confirmed || saving}>
              {t("pricing.apply")}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
