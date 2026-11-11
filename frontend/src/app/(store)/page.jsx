import { HydrationBoundary } from '@tanstack/react-query';
import { bannersQuery, categoriesQuery, faqsQuery, HOME_ROW_SORTS, productRowQuery } from '@/api/queries';
import { prefetchPage } from '@/lib/server-data';
import Home from '@/views/Home';

export const metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const { state } = await prefetchPage([
    bannersQuery('HERO'),
    bannersQuery('SIDEBAR'),
    categoriesQuery(),
    faqsQuery(true),
    ...HOME_ROW_SORTS.map((sort) => productRowQuery(sort)),
  ]);
  return (
    <HydrationBoundary state={state}>
      <Home />
    </HydrationBoundary>
  );
}
