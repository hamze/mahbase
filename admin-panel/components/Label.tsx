import { MessageKey, t } from "@/lib/i18n/fa";

/** Enum value (status, tier, reason…) as a badge with its Persian label ``<prefix>.<value>``. */
export function Label({ prefix, value, tone }: { prefix: string; value: string; tone?: "ok" | "off" }) {
  return <span className={`badge ${tone ?? ""}`}>{t(`${prefix}.${value}` as MessageKey)}</span>;
}
