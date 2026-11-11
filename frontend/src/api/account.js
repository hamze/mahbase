import { api } from '@/api/client';

export const listProvinces = () => api.get('/geo/provinces/');
export const listCities = (provinceId) => api.get('/geo/cities/', { province_id: provinceId });

/** All own addresses (a plain array, not paginated). */
export const listAddresses = () => api.get('/me/addresses/');
export const createAddress = (address) => api.post('/me/addresses/', address);
export const updateAddress = (id, address) => api.put(`/me/addresses/${id}/`, address);
export const deleteAddress = (id) => api.delete(`/me/addresses/${id}/`);
export const setDefaultAddress = (id) => api.patch(`/me/addresses/${id}/default/`);

export const listNotifications = (page) => api.get('/me/notifications/', { page });
export const markNotificationRead = (id) => api.patch(`/me/notifications/${id}/read/`);
