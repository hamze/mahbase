import { HydrationBoundary } from '@tanstack/react-query';
import { blogCategoriesQuery, blogPostsQuery } from '@/api/queries';
import { prefetchPage, searchValues } from '@/lib/server-data';
import Blog from '@/views/Blog';

export async function generateMetadata({ searchParams }) {
  const { category } = searchValues(await searchParams);
  return {
    title: 'بلاگ',
    alternates: { canonical: category ? `/blog?category=${encodeURIComponent(category)}` : '/blog' },
  };
}

export default async function BlogPage({ searchParams }) {
  const values = searchValues(await searchParams);
  const { state } = await prefetchPage([
    blogCategoriesQuery(),
    blogPostsQuery(values.category || '', Number(values.page) || 1),
  ]);
  return (
    <HydrationBoundary state={state}>
      <Blog />
    </HydrationBoundary>
  );
}
