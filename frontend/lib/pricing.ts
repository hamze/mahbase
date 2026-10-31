/** Final price display: the discount applies only while it is active. Mirrors the specified pricing rule. */
export function finalPrice(price: string | null | undefined, discount: string | null | undefined, active: boolean | undefined) {
  const amount = Number(price || 0);
  const percent = Number(discount || 0);
  return active && percent > 0 ? Math.round(amount * (100 - percent)) / 100 : amount;
}

/** "36000.00" → "36000", "0.500" → "0.5": decimal strings from the API without insignificant zeros. */
export function plainNumber(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export function formatNumber(value: number | string): string {
  return Number(value).toLocaleString("fa-IR");
}
