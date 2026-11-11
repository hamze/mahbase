"use client";

import { ActiveBadge, FieldDef, ResourceManager } from "@/components/ResourceManager";
import { createItem, listAll } from "@/lib/api/catalog";
import { generateDiscountCodes } from "@/lib/api/commerce";
import type { Category } from "@/lib/api/types";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

type Form = Record<string, unknown>;

const loadCategories = async () =>
  (await listAll<Category>("categories")).map((category) => ({ value: category.id, label: category.name }));

const isBulk = (form: Form) => Boolean(form.bulk);
const isType = (type: string) => (form: Form) => form.product_discount_type === type;

// "value" is one input for the API's ``percentage`` or ``amount``, depending on the discount type.
// Bulk codes are single-use and for anyone, so the mobile and usage-limit fields are hidden (the server enforces it).
const FIELDS: FieldDef[] = [
  { name: "bulk", label: "field.bulk", kind: "checkbox", showIf: (form) => !form.id },
  { name: "count", label: "field.count", kind: "number", showIf: isBulk },
  { name: "code", label: "field.code", kind: "text", showIf: (form) => !isBulk(form) },
  { name: "code", label: "field.codePrefix", kind: "text", showIf: isBulk },
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
  { name: "value", label: "field.discountPercent", kind: "number", showIf: isType("PERCENTAGE") },
  { name: "value", label: "field.discountAmount", kind: "number", showIf: isType("FIXED_AMOUNT") },
  { name: "max_discount_amount", label: "field.max_discount_amount", kind: "number", showIf: isType("PERCENTAGE") },
  { name: "category", label: "field.category", kind: "select", loadOptions: loadCategories },
  { name: "min_eligible_subtotal", label: "field.min_eligible_subtotal", kind: "number" },
  { name: "starts_at", label: "field.starts_at", kind: "datetime" },
  { name: "ends_at", label: "field.ends_at", kind: "datetime" },
  { name: "usage_limit_total", label: "field.usage_limit_total", kind: "number", showIf: (form) => !isBulk(form) },
  { name: "per_user_limit", label: "field.per_user_limit", kind: "number", showIf: (form) => !isBulk(form) },
  { name: "specific_mobile", label: "field.specific_mobile", kind: "text", showIf: (form) => !isBulk(form) },
  { name: "free_shipping", label: "field.free_shipping", kind: "checkbox" },
  { name: "release_on_refund", label: "field.release_on_refund", kind: "checkbox" },
  { name: "is_active", label: "field.is_active", kind: "checkbox" },
];

const EMPTY: Form = {
  bulk: false,
  count: 10,
  code: "",
  product_discount_type: "PERCENTAGE",
  value: null,
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

const toForm = (row: Form): Form => ({
  ...row,
  value: row.product_discount_type === "PERCENTAGE" ? row.percentage : row.product_discount_type === "FIXED_AMOUNT" ? row.amount : null,
});

/** Form → API payload: ``value`` back to ``percentage``/``amount``; bulk drops the single-code-only fields. */
const toPayload = async (form: Form): Promise<Form> => {
  const { value, bulk, count, ...rest } = form;
  const percentage = rest.product_discount_type === "PERCENTAGE";
  const payload: Form = {
    ...rest,
    amount: rest.product_discount_type === "FIXED_AMOUNT" ? (value ?? 0) : 0,
    percentage: percentage ? value : null,
    max_discount_amount: percentage ? rest.max_discount_amount : null,
  };
  if (!bulk) return payload;
  ["specific_mobile", "usage_limit_total", "per_user_limit"].forEach((name) => delete payload[name]);
  return { ...payload, count };
};

const create = async (payload: Form): Promise<string> => {
  if (!("count" in payload)) {
    await createItem("admin/discount-codes", payload);
    return t("common.saved");
  }
  const codes = await generateDiscountCodes(payload);
  return t("discounts.generated", { count: formatNumber(codes.length) });
};

export default function DiscountsPage() {
  return (
    <>
      <h1>{t("nav.discounts")}</h1>
      <ResourceManager
        resource="admin/discount-codes"
        section="discounts"
        permission="admin.discounts.manage"
        emptyForm={{ ...EMPTY, starts_at: new Date().toISOString() }}
        fields={FIELDS}
        toForm={toForm}
        beforeSave={toPayload}
        create={create}
        columns={[
          { label: "field.code", render: (row) => <span dir="ltr">{String(row.code)}</span> },
          { label: "field.product_discount_type", render: (row) => t(`discountType.${row.product_discount_type as "NONE"}`) },
          {
            label: "field.value",
            render: (row) =>
              row.product_discount_type === "PERCENTAGE"
                ? `${formatNumber(String(row.percentage))}٪`
                : row.product_discount_type === "FIXED_AMOUNT"
                  ? formatNumber(String(row.amount))
                  : t("common.none"),
          },
          { label: "field.used_count", render: (row) => `${row.used_count} / ${row.usage_limit_total ?? "∞"}` },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
    </>
  );
}
