"use client";

import { useState } from "react";

import { ActiveBadge, FieldDef, ResourceManager } from "@/components/ResourceManager";
import { Messages } from "@/components/Messages";
import { listAll } from "@/lib/api/catalog";
import { generateDiscountCodes } from "@/lib/api/commerce";
import { errorMessages } from "@/lib/api/errors";
import type { Category } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

const loadCategories = async () =>
  (await listAll<Category>("categories")).map((category) => ({ value: category.id, label: category.name }));

const FIELDS: FieldDef[] = [
  { name: "code", label: "field.code", kind: "text" },
  {
    name: "product_discount_type",
    label: "field.product_discount_type",
    kind: "choice",
    choices: [
      { value: "NONE", label: "discountType.NONE" },
      { value: "FIXED_AMOUNT", label: "discountType.FIXED_AMOUNT" },
      { value: "PERCENTAGE", label: "discountType.PERCENTAGE" },
    ],
  },
  { name: "amount", label: "field.amount", kind: "number" },
  { name: "percentage", label: "field.percentage", kind: "number" },
  { name: "max_discount_amount", label: "field.max_discount_amount", kind: "number" },
  { name: "category", label: "field.category", kind: "select", loadOptions: loadCategories },
  { name: "min_eligible_subtotal", label: "field.min_eligible_subtotal", kind: "number" },
  { name: "starts_at", label: "field.starts_at", kind: "datetime" },
  { name: "ends_at", label: "field.ends_at", kind: "datetime" },
  { name: "usage_limit_total", label: "field.usage_limit_total", kind: "number" },
  { name: "per_user_limit", label: "field.per_user_limit", kind: "number" },
  { name: "specific_mobile", label: "field.specific_mobile", kind: "text" },
  { name: "free_shipping", label: "field.free_shipping", kind: "checkbox" },
  { name: "release_on_refund", label: "field.release_on_refund", kind: "checkbox" },
  { name: "is_active", label: "field.is_active", kind: "checkbox" },
];

const EMPTY = {
  code: "",
  product_discount_type: "PERCENTAGE",
  amount: 0,
  percentage: null,
  max_discount_amount: null,
  category: null,
  min_eligible_subtotal: 0,
  ends_at: null,
  usage_limit_total: null,
  per_user_limit: 1,
  specific_mobile: "",
  free_shipping: false,
  release_on_refund: false,
  is_active: true,
};

export default function DiscountsPage() {
  const can = useCan();
  const [generate, setGenerate] = useState({ prefix: "", count: 10, percentage: 10 });
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const runGenerate = async () => {
    setErrors([]);
    try {
      const codes = await generateDiscountCodes({
        ...EMPTY,
        starts_at: new Date().toISOString(),
        code: generate.prefix,
        count: generate.count,
        percentage: generate.percentage,
      });
      setNotice(`${t("common.saved")} (${formatNumber(codes.length)})`);
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return (
    <>
      <h1>{t("nav.discounts")}</h1>
      <ResourceManager
        resource="admin/discount-codes"
        section="discounts"
        permission="admin.discounts.manage"
        emptyForm={{ ...EMPTY, starts_at: new Date().toISOString() }}
        fields={FIELDS}
        columns={[
          { label: "field.code", render: (row) => <span dir="ltr">{String(row.code)}</span> },
          { label: "field.product_discount_type", render: (row) => t(`discountType.${row.product_discount_type as "NONE"}`) },
          {
            label: "field.amount",
            render: (row) => (row.product_discount_type === "PERCENTAGE" ? `${row.percentage}%` : formatNumber(String(row.amount))),
          },
          { label: "field.used_count", render: (row) => `${row.used_count} / ${row.usage_limit_total ?? "∞"}` },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
      {can("admin.discounts.manage") && (
        <div className="card">
          <h2 className="card-title">{t("action.generate")}</h2>
          <p className="muted">{t("discounts.generateHint")}</p>
          <Messages errors={errors} notice={notice} />
          <div className="row">
            <label>
              {t("field.code")}
              <input dir="ltr" value={generate.prefix} onChange={(e) => setGenerate({ ...generate, prefix: e.target.value })} />
            </label>
            <label>
              {t("field.count")}
              <input type="number" value={generate.count} onChange={(e) => setGenerate({ ...generate, count: Number(e.target.value) })} />
            </label>
            <label>
              {t("field.percentage")}
              <input
                type="number"
                value={generate.percentage}
                onChange={(e) => setGenerate({ ...generate, percentage: Number(e.target.value) })}
              />
            </label>
            <button className="primary" onClick={runGenerate}>
              {t("action.generate")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
