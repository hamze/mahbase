import 'server-only';

import { cache } from 'react';
import { dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getCategories } from '@/api/catalog';
import { getStoreSettings } from '@/api/content';
import { makeQueryClient } from '@/lib/query-client';

/** Absolute storefront origin for canonical URLs, Open Graph and the sitemap. */
export const siteUrl = () => (process.env.STOREFRONT_URL || 'http://localhost:5173').replace(/\/$/, '');

/** Store settings once per request (metadata and the layouts share it). */
export const storeSettings = cache(getStoreSettings);

/**
 * Prefetch the queries a server-rendered page needs and return the dehydrated cache for ``HydrationBoundary``.
 * ``required`` is the page's main query: its 404 becomes the page's 404 and its data is returned.
 */
export async function prefetchPage(queries, required) {
  const queryClient = makeQueryClient();
  let data;
  if (required) {
    try {
      data = await queryClient.fetchQuery(required);
    } catch (error) {
      if (error.status === 404) notFound();
      throw error;
    }
  }
  await Promise.all(queries.map((query) => queryClient.prefetchQuery(query)));
  return { data, state: dehydrate(queryClient) };
}

/** One value per search param, the last when repeated (``?a=1&a=2`` → ``{a: "2"}``), as the client reads them. */
export function searchValues(searchParams) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[value.length - 1] : value]),
  );
}

/** Serialize JSON-LD for a ``<script type="application/ld+json">``, safe inside HTML. */
export const jsonLd = (value) => ({ __html: JSON.stringify(value).replace(/</g, '\\u003c') });

/** Active category tree once per request (metadata and the page share it). */
export const categoryTree = cache(getCategories);

const flattenCategories = (categories) => categories.flatMap((c) => [c, ...flattenCategories(c.children || [])]);

export async function findCategory(slug) {
  return slug ? flattenCategories(await categoryTree()).find((c) => c.slug === slug) : undefined;
}

/** Media URLs from the API are site-relative (``/media/…``); structured data needs them absolute. */
export const absoluteUrl = (url) => (url && url.startsWith('/') ? `${siteUrl()}${url}` : url);
