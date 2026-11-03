import { apiRequest, Page } from "@/lib/api/client";
import type { Product, ProductInput, Variant } from "@/lib/api/types";

export type ProductFilters = {
  search?: string;
  category?: string;
  brand?: string;
  is_published?: string;
  deleted?: string;
  page?: string;
};

export function listProducts(filters: ProductFilters): Promise<Page<Product>> {
  return apiRequest<Page<Product>>("products", { query: filters });
}

export function getProduct(slug: string): Promise<Product> {
  return apiRequest<Product>(`products/${encodeURIComponent(slug)}`);
}

export function createProduct(data: ProductInput): Promise<Product> {
  return apiRequest<Product>("products", { method: "POST", json: data });
}

export function updateProduct(id: number, data: ProductInput): Promise<Product> {
  return apiRequest<Product>(`products/${id}`, { method: "PUT", json: data });
}

export function togglePublish(id: number): Promise<Product> {
  return apiRequest<Product>(`products/${id}/toggle-publish`, { method: "PATCH" });
}

export function deleteProduct(id: number): Promise<null> {
  return apiRequest<null>(`products/${id}`, { method: "DELETE" });
}

export function restoreProduct(id: number): Promise<Product> {
  return apiRequest<Product>(`products/${id}/restore`, { method: "PATCH" });
}

export function addVariant(productId: number, variant: Variant): Promise<Variant> {
  return apiRequest<Variant>(`products/${productId}/variants`, { method: "POST", json: variant });
}

export function updateVariant(productId: number, variantId: number, variant: Variant): Promise<Variant> {
  return apiRequest<Variant>(`products/${productId}/variants/${variantId}`, { method: "PUT", json: variant });
}

/**
 * Stock below the reserved quantity fails with 409 ``StockBelowReserved`` (affected orders listed) unless
 * ``confirm`` is true, which invalidates those reserved orders.
 */
export function updateStock(
  variantId: number,
  change: ({ stock_quantity: string } | { delta: string }) & { confirm?: boolean },
): Promise<Variant> {
  return apiRequest<Variant>(`variants/${variantId}/stock`, { method: "PATCH", json: change });
}

export type PriceChange = Pick<Variant, "base_price" | "wholesale_price" | "discount_percentage" | "is_discount_active">;

export function updateVariantPrice(variantId: number, change: PriceChange): Promise<Variant> {
  return apiRequest<Variant>(`variants/${variantId}/price`, { method: "PATCH", json: change });
}

/** Scale base and wholesale prices of all variants (or one category and its subcategories) by a percentage. */
export function adjustPrices(percentage: string, category: number | null): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>("variants/adjust-prices", { method: "POST", json: { percentage, category } });
}
