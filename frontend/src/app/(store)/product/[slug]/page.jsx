import { cache } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getProduct } from '@/api/catalog';
import { productQuery, questionsQuery, relatedProductsQuery, reviewsQuery } from '@/api/queries';
import { absoluteUrl, jsonLd, prefetchPage, siteUrl } from '@/lib/server-data';
import ProductDetail from '@/views/ProductDetail';

const loadProduct = cache(async (slug) => {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const path = `/product/${encodeURIComponent(product.slug)}`;
  return {
    title: product.name,
    description: product.description_short || undefined,
    alternates: { canonical: path },
    openGraph: { url: path, title: product.name, description: product.description_short || undefined, images: product.image_url ? [product.image_url] : undefined },
  };
}

/** schema.org Product (price of the cheapest variant for anonymous visitors, stock and rating). */
function productSchema(product) {
  const offer = product.price && {
    '@type': 'Offer',
    priceCurrency: 'IRR',
    // Prices are Toman; schema.org expects the ISO currency (1 Toman = 10 Rial).
    price: String(Number(product.price.price) * 10),
    availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: `${siteUrl()}/product/${encodeURIComponent(product.slug)}`,
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.variants[0]?.sku,
    description: product.description_short || undefined,
    image: (product.media.length ? product.media.map((m) => m.url) : [product.image_url]).filter(Boolean).map(absoluteUrl),
    brand: product.brand_name ? { '@type': 'Brand', name: product.brand_name } : undefined,
    category: product.category_name,
    offers: offer || undefined,
    aggregateRating: product.rating_count
      ? { '@type': 'AggregateRating', ratingValue: product.rating_average, reviewCount: product.rating_count }
      : undefined,
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const { state } = await prefetchPage([
    { ...productQuery(slug), queryFn: () => product },
    relatedProductsQuery(slug),
    reviewsQuery(slug),
    questionsQuery(product.id),
  ]);
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productSchema(product))} />
      <ProductDetail slug={slug} />
    </HydrationBoundary>
  );
}
