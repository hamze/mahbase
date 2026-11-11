import { formatPrice, formatQuantity, faNum } from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import { orderStatusLabel, paymentStatusLabel } from '@/components/account/order-labels';

const isZero = (value) => Number(value || 0) === 0;

/**
 * Totals rows of an order exactly as the server computed them (no client math). Discounts, shipping discount and
 * other costs appear when non-zero; packaging and tax always (0 when zero), as on the invoice.
 */
export function orderTotalRows(order) {
  // subtotal_products is already after the product discounts, so that discount is shown as information only.
  const rows = [{ label: 'جمع کالاها', value: order.subtotal_products }];
  if (!isZero(order.product_discount_total)) {
    rows.push({ label: 'سود شما از تخفیف کالاها (در قیمت‌ها اعمال شده)', value: order.product_discount_total });
  }
  if (!isZero(order.discount_amount)) {
    const code = order.discount_code_snapshot ? ` (${order.discount_code_snapshot})` : '';
    rows.push({ label: `کد تخفیف${code}`, value: order.discount_amount, negative: true });
  }
  const method = order.shipping_method_name_snapshot ? ` (${order.shipping_method_name_snapshot})` : '';
  rows.push({ label: `هزینه ارسال${method}`, value: order.shipping_cost });
  if (!isZero(order.shipping_discount_amount)) rows.push({ label: 'تخفیف ارسال', value: order.shipping_discount_amount, negative: true });
  if (!isZero(order.other_costs)) rows.push({ label: 'سایر هزینه‌ها', value: order.other_costs });
  rows.push({ label: 'هزینه بسته‌بندی', value: order.packaging_fee });
  rows.push({ label: `مالیات بر ارزش افزوده (${faNum(Number(order.tax_percentage || 0))}٪)`, value: order.tax_amount });
  return rows;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const money = (value, negative) => `${negative ? '− ' : ''}${formatPrice(value)}`;

/** Invoice of a full order (``getMyOrder`` / ``placeOrder().order`` shape). */
export function orderInvoiceHtml(order) {
  const items = (order.items || [])
    .map((item) => {
      const name = [item.product_name_snapshot, item.variant_label_snapshot].filter(Boolean).join(' - ');
      return `<tr><td>${escapeHtml(name)}</td><td>${formatQuantity(item.quantity)} ${escapeHtml(item.unit_name_snapshot)}</td>`
        + `<td>${formatPrice(item.unit_price)}</td><td>${formatPrice(item.line_total)}</td></tr>`;
    })
    .join('');
  const totals = orderTotalRows(order)
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${money(row.value, row.negative)}</td></tr>`)
    .join('');
  const address = order.address || {};
  const addressText = [
    address.province_name,
    address.city_name,
    address.address_line,
    address.plaque && `پلاک ${address.plaque}`,
    address.unit && `واحد ${address.unit}`,
    address.postal_code && `کد پستی ${address.postal_code}`,
  ].filter(Boolean).join('، ');
  return `
    <section>
      <h2>فاکتور سفارش ${escapeHtml(order.order_number)}</h2>
      <p class="meta">تاریخ: ${formatJalali(order.placed_at, true)} — وضعیت: ${escapeHtml(orderStatusLabel(order.order_status))} / ${escapeHtml(paymentStatusLabel(order.payment_status))}</p>
      <table>
        <thead><tr><th>کالا</th><th>مقدار</th><th>قیمت واحد (تومان)</th><th>جمع (تومان)</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <table class="totals">
        ${totals}
        <tr><th>مبلغ قابل پرداخت (تومان)</th><th>${formatPrice(order.payable_total)}</th></tr>
      </table>
      <p class="meta">گیرنده: ${escapeHtml(address.receiver_name || '—')} (${escapeHtml(address.receiver_mobile || '—')}) — ${escapeHtml(addressText)}</p>
    </section>`;
}

export function printOrders(orders, storeName = '') {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>فاکتور ${escapeHtml(storeName)}</title>
  <style>body{font-family:Tahoma,sans-serif;padding:24px;color:#111} h2{font-size:15px;margin:0 0 4px} .meta{font-size:12px;color:#555} table{width:100%;border-collapse:collapse;margin-top:8px} .totals{margin-top:12px;width:60%} th,td{border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:12px} .page-break{page-break-after:always;height:40px}</style>
  </head><body>${storeName ? `<h1 style="font-size:17px">${escapeHtml(storeName)}</h1>` : ''}${orders.map(orderInvoiceHtml).join('<div class="page-break"></div>')}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
