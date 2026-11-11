import { api } from '@/api/client';

/** Active shipping methods serving a city. */
export const listShippingMethods = (cityId) => api.get('/shipping-methods/', { city_id: cityId });

/** Checkout totals exactly as confirmation computes them (packaging and tax included). */
export const quoteOrder = ({ shippingMethod, discountCode }) =>
  api.post('/orders/quote/', { shipping_method: shippingMethod ?? null, discount_code: discountCode || '' });

/**
 * Confirm the cart: reserves stock and returns ``{order_number, payment_redirect_url, order}``.
 * ``idempotencyKey`` must stay the same when the same confirmation is retried.
 */
export const placeOrder = ({ address, shippingMethod, discountCode }, idempotencyKey) =>
  api.post(
    '/orders/',
    { address, shipping_method: shippingMethod, discount_code: discountCode || '' },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );

export const listMyOrders = (page) => api.get('/me/orders/', { page });
export const getMyOrder = (orderNumber) => api.get(`/me/orders/${orderNumber}/`);
/** A new bank link for an unpaid order that still holds its stock. */
export const payOrder = (orderNumber) => api.post(`/me/orders/${orderNumber}/pay/`);
/** ``items``: ``[{order_item, quantity}]`` of a delivered order. */
export const requestReturn = (orderNumber, reason, items) =>
  api.post(`/me/orders/${orderNumber}/return-request/`, { reason, items });
