import { api } from '@/api/client';

/** Cart ``{items, subtotal, warnings}``; guests use the backend session cart, customers their saved cart. */
export const getCart = () => api.get('/cart/');
export const addCartItem = (variantId, quantity) => api.post('/cart/items/', { variant: variantId, quantity });
export const setCartItemQuantity = (variantId, quantity) => api.patch(`/cart/items/${variantId}/`, { quantity });
export const removeCartItem = (variantId) => api.delete(`/cart/items/${variantId}/`);
export const clearCart = () => api.delete('/cart/');
