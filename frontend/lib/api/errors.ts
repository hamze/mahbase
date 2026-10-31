import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n/fa";

/** Flatten DRF error payloads ({field: [messages]}, {detail}, [messages]) into display lines. */
export function errorMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [t("common.error")];
  if (error.status === 403) return [t("common.forbidden")];
  if (error.status === 409) return [t("common.conflict")];
  const lines: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (typeof value === "string") lines.push(prefix ? `${prefix}: ${value}` : value);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, prefix));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([key, item]) => walk(item, key === "detail" || key === "non_field_errors" ? prefix : key));
  };
  walk(error.data, "");
  return lines.length ? lines : [t("common.error")];
}
