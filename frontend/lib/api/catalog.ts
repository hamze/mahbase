import { apiRequest, Page } from "@/lib/api/client";
import type { AttributeOption, DeleteResult } from "@/lib/api/types";

export type CatalogResource =
  | "categories"
  | "tags"
  | "brands"
  | "units"
  | "attributes"
  | "admin/discount-codes"
  | "admin/shipping-methods"
  | "admin/faq-categories"
  | "admin/faqs"
  | "admin/blog/categories"
  | "admin/banners"
  | "admin/provinces"
  | "admin/cities";

/** Fetch every row of a metadata list (admin catalogs are small); optionally scoped to a category or filtered. */
export async function listAll<T>(
  resource: CatalogResource,
  category?: number,
  filters: Record<string, string> = {},
): Promise<T[]> {
  const page = await apiRequest<Page<T>>(resource, {
    query: { page_size: "500", category: category ? String(category) : undefined, ...filters },
  });
  return page.results;
}

export function createItem<T>(resource: CatalogResource, data: Partial<T>): Promise<T> {
  return apiRequest<T>(resource, { method: "POST", json: data });
}

export function updateItem<T>(resource: CatalogResource, id: number, data: Partial<T>): Promise<T> {
  return apiRequest<T>(`${resource}/${id}`, { method: "PUT", json: data });
}

/** Returns ``{deactivated: true}`` when the backend kept a referenced row and deactivated it instead. */
export function deleteItem(resource: CatalogResource, id: number): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(`${resource}/${id}`, { method: "DELETE" });
}

export function createOption(attributeId: number, data: Partial<AttributeOption>): Promise<AttributeOption> {
  return apiRequest<AttributeOption>(`attributes/${attributeId}/options`, { method: "POST", json: data });
}

export function updateOption(attributeId: number, id: number, data: Partial<AttributeOption>): Promise<AttributeOption> {
  return apiRequest<AttributeOption>(`attributes/${attributeId}/options/${id}`, { method: "PUT", json: data });
}

export function deleteOption(attributeId: number, id: number): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(`attributes/${attributeId}/options/${id}`, { method: "DELETE" });
}
