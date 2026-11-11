'use client';

import { useQuery } from '@tanstack/react-query';
import { internalPagesQuery, storeSettingsQuery } from '@/api/queries';

/** Public store settings (shared cache, seeded by the root layout's server render). */
export function useStoreSettings() {
  const { data } = useQuery(storeSettingsQuery());
  return data;
}

/** ``[{title, slug}]`` of the internal pages (about, terms, …) for the header/footer menus. */
export function useInternalPages() {
  const { data } = useQuery(internalPagesQuery());
  return data || [];
}
