import type { Variant } from "@/lib/api/types";
import { t } from "@/lib/i18n/fa";

/** Human-readable name of a variant from its attribute values, e.g. "نوع برش: استیکی". */
export function variantLabel(variant: Variant): string {
  return variant.attributes.length
    ? variant.attributes.map((value) => `${value.attribute_name}: ${value.value}`).join(" / ")
    : t("product.defaultVariant");
}
