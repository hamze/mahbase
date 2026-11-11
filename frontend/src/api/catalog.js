import { api } from '@/api/client';

/** Active main categories, each with ``children`` (two levels). */
export const getCategories = () => api.get('/shop/categories/');

/** Brands and filterable attributes (``[{id, name, values}]``) used by a category's products. */
export const getCategoryFilters = (slug) => api.get(`/shop/categories/${encodeURIComponent(slug)}/filters/`);

/**
 * Paginated product cards ``{count, next, previous, results}``.
 * filters: search, category (slug|id), brand ("1,2"), tag, min_price, max_price, in_stock ("true"),
 * attr_<id> ("v1,v2"), sort (newest|cheapest|expensive|discount|popular|rating), page, page_size.
 */
export const listProducts = (filters = {}) => api.get('/shop/products/', filters);

export const getProduct = (slug) => api.get(`/shop/products/${encodeURIComponent(slug)}/`);

export const getRelatedProducts = (slug) => api.get(`/shop/products/${encodeURIComponent(slug)}/related/`);

export const listReviews = (slug, page) => api.get(`/products/${encodeURIComponent(slug)}/reviews/`, { page });

export const createReview = (slug, review) => api.post(`/products/${encodeURIComponent(slug)}/reviews/`, review);

export const listQuestions = (productId, page) => api.get(`/products/${productId}/questions/`, { page });

export const askQuestion = (productId, questionText) =>
  api.post(`/products/${productId}/questions/`, { question_text: questionText });
