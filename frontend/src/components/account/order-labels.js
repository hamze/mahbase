/** Persian labels (and badge tones) for the backend order, payment, return and refund statuses. */

export const ORDER_STATUS = {
  PENDING_PAYMENT: { label: 'در انتظار پرداخت', tone: 'warning' },
  IN_PREPARATION: { label: 'در حال آماده‌سازی', tone: 'info' },
  READY_TO_SHIP: { label: 'آماده ارسال', tone: 'info' },
  SHIPPED: { label: 'ارسال شده', tone: 'info' },
  DELIVERED: { label: 'تحویل شده', tone: 'success' },
  CANCELLED: { label: 'لغو شده', tone: 'destructive' },
  RETURNED: { label: 'مرجوع شده', tone: 'muted' },
};

export const PAYMENT_STATUS = {
  UNPAID: { label: 'پرداخت نشده', tone: 'muted' },
  PENDING: { label: 'در انتظار تایید بانک', tone: 'warning' },
  PAID: { label: 'پرداخت شده', tone: 'success' },
  FAILED: { label: 'پرداخت ناموفق', tone: 'destructive' },
  PARTIALLY_REFUNDED: { label: 'بازپرداخت جزئی', tone: 'info' },
  REFUNDED: { label: 'بازپرداخت شده', tone: 'info' },
};

export const TRANSACTION_STATUS = {
  INITIATED: 'ایجاد شده',
  PENDING: 'در انتظار',
  SUCCESS: 'موفق',
  FAILED: 'ناموفق',
  REFUNDED: 'بازپرداخت شده',
  PARTIALLY_REFUNDED: 'بازپرداخت جزئی',
  REJECTED_AFTER_RELEASE: 'رد شده (پس از آزادسازی موجودی)',
  SUCCESS_BUT_REJECTED: 'موفق ولی رد شده',
  DUPLICATE_REJECTED: 'تکراری (رد شده)',
};

export const RETURN_STATUS = {
  REQUESTED: 'ثبت شده',
  APPROVED: 'تایید شده',
  RECEIVED: 'دریافت شده',
  COMPLETED: 'تکمیل شده',
  REJECTED: 'رد شده',
  CANCELLED: 'لغو شده',
};

export const REFUND_STATUS = {
  REQUESTED: 'ثبت شده',
  APPROVED: 'تایید شده',
  PROCESSING: 'در حال پردازش',
  COMPLETED: 'واریز شده',
  FAILED: 'ناموفق',
  REJECTED: 'رد شده',
};

export const REFUND_REASON = {
  ADMIN_CANCEL_BEFORE_SHIP: 'لغو سفارش پیش از ارسال',
  RETURN: 'مرجوعی کالا',
  PAYMENT_AFTER_RELEASE: 'پرداخت پس از آزادسازی موجودی',
  STOCK_INVALIDATED: 'عدم موجودی',
  PAYMENT_AMOUNT_MISMATCH: 'مغایرت مبلغ پرداخت',
};

export const orderStatusLabel = (status) => ORDER_STATUS[status]?.label || status;
export const paymentStatusLabel = (status) => PAYMENT_STATUS[status]?.label || status;
