import { HydrationBoundary } from '@tanstack/react-query';
import { bannersQuery, categoriesQuery } from '@/api/queries';
import { prefetchPage } from '@/lib/server-data';
import Layout from '@/components/store/Layout';

export default async function StoreLayout({ children }) {
  const { state } = await prefetchPage([categoriesQuery(), bannersQuery('TOP_HEADER')]);
  return (
    <HydrationBoundary state={state}>
      <Layout>{children}</Layout>
    </HydrationBoundary>
  );
}
