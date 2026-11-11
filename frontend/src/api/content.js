import { api } from '@/api/client';

/** Public store settings: name, logo, contact, social links, trust badges, footer HTML, packaging fee, tax. */
export const getStoreSettings = () => api.get('/settings/', undefined, { auth: false });

/** position: TOP_HEADER | HERO | SIDEBAR. */
export const listBanners = (position) => api.get('/banners/', { position }, { auth: false });

export const listFaqCategories = () => api.get('/faq-categories/', undefined, { auth: false });
export const listFaqs = (filters = {}) => api.get('/faqs/', filters, { auth: false });

export const listBlogCategories = () => api.get('/blog/categories/', undefined, { auth: false });
export const listBlogPosts = (filters = {}) => api.get('/blog/posts/', filters, { auth: false });
export const getBlogPost = (slug) => api.get(`/blog/posts/${encodeURIComponent(slug)}/`, undefined, { auth: false });

/** ``[{title, slug}]`` of the internal pages (about, terms, …) for menus. */
export const listInternalPages = () => api.get('/blog/internal-pages/', undefined, { auth: false });
export const getInternalPage = (slug) =>
  api.get(`/blog/internal-pages/${encodeURIComponent(slug)}/`, undefined, { auth: false });

export const sendContactMessage = (message) => api.post('/contact-messages/', message, { auth: false });
