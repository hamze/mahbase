import { MessageKey, t } from "@/lib/i18n/fa";

/** "Admin Panel Guide" help block shown at the top of each section. */
export function Guide({ section, example = false }: { section: string; example?: boolean }) {
  return (
    <section className="guide">
      <span className="muted">{t("guide.label")}</span>
      <h2>{t(`guide.${section}.title` as MessageKey)}</h2>
      <p>{t(`guide.${section}.description` as MessageKey)}</p>
      {example && (
        <p className="muted">
          {t("guide.example")}: {t(`guide.${section}.example` as MessageKey)}
        </p>
      )}
    </section>
  );
}
