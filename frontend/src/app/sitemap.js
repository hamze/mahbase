import { listProducts } from '@/api/catalog';
import { listBlogPosts, listInternalPages } from '@/api/content';
import { categoryTree, siteUrl } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 500;

/** Every page of a paginated list endpoint. */
async function allPages(list, filters = {}) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const result = await list({ ...filters, page, page_size: PAGE_SIZE });
    items.push(...result.results);
    if (!result.next) return items;
  }
}

const flatten = (categories) => categories.flatMap((c) => [c, ...flatten(c.children || [])]);

export default async function sitemap() {
  const base = siteUrl();
  const [products, posts, pages, categories] = await Promise.all([
    allPages(listProducts),
    allPages(listBlogPosts),
    listInternalPages(),
    categoryTree(),
  ]);
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
    ...flatten(categories).map((c) => ({ url: `${base}/products?category=${encodeURIComponent(c.slug)}`, changeFrequency: 'daily', priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${encodeURIComponent(p.slug)}`, changeFrequency: 'weekly', priority: 0.8 })),
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    ...posts.map((p) => ({
      url: `${base}/blog/${encodeURIComponent(p.slug)}`,
      lastModified: p.published_at || undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    ...pages.map((p) => ({ url: `${base}/pages/${encodeURIComponent(p.slug)}`, changeFrequency: 'monthly', priority: 0.4 })),
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
