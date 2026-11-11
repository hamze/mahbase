import { QueryClient, isServer } from '@tanstack/react-query';

/**
 * One QueryClient per server render (requests never share cached data) and one for the browser session. A short
 * ``staleTime`` keeps server-rendered data from being refetched the moment it hydrates; account data opts out.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 60 * 1000 },
    },
  });
}

let browserQueryClient;

export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
