import { Page } from "@/lib/api/client";
import { t } from "@/lib/i18n/fa";
import type { Query } from "@/lib/hooks/usePagedList";

/** Previous/next buttons for a DRF page; the page number lives in the list query. */
export function Pager<T>({ page, query, setQuery }: { page: Page<T> | null; query: Query; setQuery: (query: Query) => void }) {
  const current = Number(query.page ?? 1);
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <button disabled={!page?.previous} onClick={() => setQuery({ ...query, page: String(current - 1) })}>
        {t("common.previous")}
      </button>
      <button disabled={!page?.next} onClick={() => setQuery({ ...query, page: String(current + 1) })}>
        {t("common.next")}
      </button>
    </div>
  );
}

