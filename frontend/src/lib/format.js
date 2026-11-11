const number = new Intl.NumberFormat('fa-IR');

/** Toman amount from an API decimal string or number, with Persian digits. */
export const formatPrice = (value) => number.format(Math.round(Number(value) || 0));

/** Quantity (decimal string) without trailing zeros, with Persian digits. */
export const formatQuantity = (value) => number.format(Number(value) || 0);

export const faNum = (value) => number.format(value);

export const MOBILE_PATTERN = /^09\d{9}$/;
