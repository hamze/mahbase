import { cache } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getInternalPage } from '@/api/content';
import { internalPageQuery } from '@/api/queries';
import { prefetchPage } from '@/lib/server-data';
import InternalPage from '@/views/InternalPage';

const loadPage = cache(async (slug) => {
  try {
    return await getInternalPage(slug);
  } catch (error) {
    if (error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || page.excerpt || undefined,
    alternates: { canonical: page.canonical_url || `/pages/${encodeURIComponent(page.slug)}` },
  };
}

export default async function InternalPageRoute({ params }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  const { state } = await prefetchPage([{ ...internalPageQuery(slug), queryFn: () => page }]);
  return (
    <HydrationBoundary state={state}>
      <InternalPage slug={slug} />
    </HydrationBoundary>
  );
}
