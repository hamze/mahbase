/**
 * React Query definitions shared by client views and the server pages that prefetch them, so the server-rendered
 * HTML and the browser cache use the same keys.
 */
import { getCategories, getCategoryFilters, getProduct, getRelatedProducts, listProducts, listQuestions, listReviews } from '@/api/catalog';
import {
  getBlogPost,
  getInternalPage,
  getStoreSettings,
  listBanners,
  listBlogCategories,
  listBlogPosts,
  listFaqCategories,
  listFaqs,
  listInternalPages,
} from '@/api/content';

const CONTENT_STALE_TIME = 5 * 60 * 1000;

/**
 * Catalog prices depend on the customer's tier, so product queries carry it in their key: the server renders
 * anonymous (retail) data, and a wholesale customer's browser fetches its own instead of reusing it.
 * ``tier`` is ``usePriceTier()`` in client views; server pages use the default.
 */
const RETAIL = 'RETAIL';

export const PRODUCT_ROW_SIZE = 10;
export const PRODUCTS_PAGE_SIZE = 24;

export const storeSettingsQuery = () => ({ queryKey: ['store-settings'], queryFn: getStoreSettings, staleTime: CONTENT_STALE_TIME });
export const internalPagesQuery = () => ({ queryKey: ['internal-pages'], queryFn: listInternalPages, staleTime: CONTENT_STALE_TIME });
export const categoriesQuery = () => ({ queryKey: ['categories'], queryFn: getCategories, staleTime: CONTENT_STALE_TIME });
export const bannersQuery = (position) => ({ queryKey: ['banners', position], queryFn: () => listBanners(position) });

/** Sorts of the home page's product rows. */
export const HOME_ROW_SORTS = ['newest', 'discount', 'popular'];

/** Home rows: one page of ``PRODUCT_ROW_SIZE`` cards in ``sort`` order. */
export const productRowQuery = (sort, tier = RETAIL) => {
  const filters = { sort, page_size: PRODUCT_ROW_SIZE };
  return { queryKey: ['products', tier, filters], queryFn: () => listProducts(filters) };
};

/** Product list for the URL query ``values`` (category, filters, page); ``sort`` defaults to newest. */
export const productsQuery = (values, tier = RETAIL) => {
  const filters = { ...values, sort: values.sort || 'newest', page_size: PRODUCTS_PAGE_SIZE };
  return { queryKey: ['products', tier, filters], queryFn: () => listProducts(filters) };
};

export const categoryFiltersQuery = (slug) => ({
  queryKey: ['category-filters', slug],
  queryFn: () => getCategoryFilters(slug),
  enabled: Boolean(slug),
});

export const productQuery = (slug, tier = RETAIL) => ({ queryKey: ['product', tier, slug], queryFn: () => getProduct(slug) });
export const relatedProductsQuery = (slug, tier = RETAIL) => ({
  queryKey: ['related-products', tier, slug],
  queryFn: () => getRelatedProducts(slug),
});

/** Approved reviews; 403 means the store disabled reviews (the section is hidden), so it is not retried. */
export const reviewsQuery = (slug) => ({
  queryKey: ['reviews', slug],
  queryFn: () => listReviews(slug),
  retry: (failures, error) => error.status !== 403 && failures < 1,
});

export const questionsQuery = (productId) => ({ queryKey: ['questions', productId], queryFn: () => listQuestions(productId) });

/** ``home`` limits the list to the FAQs shown on the home page. */
export const faqsQuery = (home = false) =>
  home
    ? { queryKey: ['faqs', { home: 'true' }], queryFn: () => listFaqs({ home: 'true' }) }
    : { queryKey: ['faqs'], queryFn: () => listFaqs() };
export const faqCategoriesQuery = () => ({ queryKey: ['faq-categories'], queryFn: listFaqCategories });

export const blogCategoriesQuery = () => ({ queryKey: ['blog-categories'], queryFn: listBlogCategories, staleTime: CONTENT_STALE_TIME });
export const blogPostsQuery = (category, page) => ({
  queryKey: ['blog-posts', category, page],
  queryFn: () => listBlogPosts({ category, page }),
});

const notRetriedOn404 = (count, error) => error.status !== 404 && count < 1;
export const blogPostQuery = (slug) => ({ queryKey: ['blog-post', slug], queryFn: () => getBlogPost(slug), retry: notRetriedOn404 });
export const internalPageQuery = (slug) => ({
  queryKey: ['internal-page', slug],
  queryFn: () => getInternalPage(slug),
  retry: notRetriedOn404,
});
