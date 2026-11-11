import { HydrationBoundary } from '@tanstack/react-query';
import { categoriesQuery, categoryFiltersQuery, productsQuery } from '@/api/queries';
import { findCategory, prefetchPage, searchValues } from '@/lib/server-data';
import Products from '@/views/Products';

/** Category listings (optionally paged) are indexed; search, filter and sort variants point to them instead. */
export async function generateMetadata({ searchParams }) {
  const values = searchValues(await searchParams);
  const category = await findCategory(values.category);
  const canonical = category ? `/products?category=${encodeURIComponent(category.slug)}` : '/products';
  const indexable = Object.keys(values).every((key) => key === 'category' || key === 'page');
  return {
    title: values.search ? `جستجوی «${values.search}»` : category?.seo_title || category?.name || 'همه محصولات',
    description: category?.seo_description || undefined,
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function ProductsPage({ searchParams }) {
  const values = searchValues(await searchParams);
  const queries = [categoriesQuery(), productsQuery(values)];
  if (values.category) queries.push(categoryFiltersQuery(values.category));
  const { state } = await prefetchPage(queries);
  return (
    <HydrationBoundary state={state}>
      <Products />
    </HydrationBoundary>
  );
}
