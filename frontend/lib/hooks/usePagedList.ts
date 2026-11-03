"use client";

import { useCallback, useEffect, useState } from "react";

import { Page } from "@/lib/api/client";
import { errorMessages } from "@/lib/api/errors";
import { t } from "@/lib/i18n/fa";

export type Query = Record<string, string | undefined>;

/** A paginated admin list with filters, plus ``run`` for row actions (shows errors / "saved", then reloads). */
export function usePagedList<T>(fetchPage: (query: Query) => Promise<Page<T>>, initialQuery: Query = {}) {
  const [query, setQuery] = useState<Query>(initialQuery);
  const [page, setPage] = useState<Page<T> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const reload = useCallback(async () => {
    try {
      setPage(await fetchPage(query));
    } catch (error) {
      setErrors(errorMessages(error));
    }
  }, [fetchPage, query]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (action: () => Promise<unknown>, success: string = t("common.saved")) => {
    setErrors([]);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      await reload();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return { page, query, setQuery, reload, run, errors, notice };
}
