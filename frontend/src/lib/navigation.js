'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/** The current path with its query string (``/products?sort=new``), e.g. for a login ``returnTo``. */
export function useCurrentPath() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** Login link that brings the customer back to ``path`` afterwards. */
export const loginPath = (path) => `/login?returnTo=${encodeURIComponent(path)}`;
