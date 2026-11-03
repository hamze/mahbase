import { apiRequest, Page } from "@/lib/api/client";
import type {
  Address,
  AdminOrderCreate,
  AdminUser,
  AuditEntry,
  City,
  CustomerTier,
  Order,
  OrderCreated,
  OrderListItem,
  OrderRefund,
  OrderStatus,
  OrderVariantOption,
  PreparationStatus,
  ProductQuestion,
  Province,
  ReturnRequest,
  ShippingOption,
} from "@/lib/api/types";

type Query = Record<string, string | undefined>;

export function listUsers(query: Query): Promise<Page<AdminUser>> {
  return apiRequest<Page<AdminUser>>("admin/users", { query });
}

export function createUser(data: Pick<AdminUser, "mobile" | "first_name" | "last_name" | "customer_tier">): Promise<AdminUser> {
  return apiRequest<AdminUser>("admin/users", { method: "POST", json: data });
}

export function updateUserNames(id: number, data: Pick<AdminUser, "first_name" | "last_name">): Promise<AdminUser> {
  return apiRequest<AdminUser>(`admin/users/${id}`, { method: "PATCH", json: data });
}

export function setUserTier(id: number, customer_tier: AdminUser["customer_tier"]): Promise<AdminUser> {
  return apiRequest<AdminUser>(`admin/users/${id}/tier`, { method: "PATCH", json: { customer_tier } });
}

export function changeUserState(id: number, change: "block" | "deactivate" | "reactivate"): Promise<AdminUser> {
  return apiRequest<AdminUser>(`admin/users/${id}/${change}`, { method: "POST" });
}

export function listOrders(query: Query): Promise<Page<OrderListItem>> {
  return apiRequest<Page<OrderListItem>>("admin/orders", { query });
}

export function getOrder(orderNumber: string): Promise<Order> {
  return apiRequest<Order>(`admin/orders/${orderNumber}`);
}

/** Places an order for a customer; repeat with the same ``idempotencyKey`` after a lost response. */
export function createOrder(data: AdminOrderCreate, idempotencyKey: string): Promise<OrderCreated> {
  return apiRequest<OrderCreated>("admin/orders", {
    method: "POST",
    json: data,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function searchOrderCustomers(search: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("admin/orders/customers", { query: { search } });
}

export function listCustomerAddresses(userId: number): Promise<Address[]> {
  return apiRequest<Address[]>(`admin/orders/customers/${userId}/addresses`);
}

export function searchOrderVariants(search: string, customer_tier: CustomerTier): Promise<OrderVariantOption[]> {
  return apiRequest<OrderVariantOption[]>("admin/orders/variants", { query: { search, customer_tier } });
}

export function setOrderStatus(orderNumber: string, order_status: OrderStatus): Promise<Order> {
  return apiRequest<Order>(`admin/orders/${orderNumber}/status`, { method: "PATCH", json: { order_status } });
}

/** Unpaid orders are cancelled at once; paid ones get an approved refund and are cancelled when it completes. */
export function cancelOrder(orderNumber: string): Promise<Order | OrderRefund> {
  return apiRequest<Order | OrderRefund>(`admin/orders/${orderNumber}/cancel`, { method: "POST" });
}

export function setPreparationStatus(orderNumber: string, itemId: number, preparation_status: PreparationStatus) {
  return apiRequest(`admin/orders/${orderNumber}/items/${itemId}/preparation-status`, {
    method: "PATCH",
    json: { preparation_status },
  });
}

export function listRefunds(query: Query): Promise<Page<OrderRefund>> {
  return apiRequest<Page<OrderRefund>>("admin/refunds", { query });
}

export function refundAction(id: number, step: "approve" | "reject" | "process"): Promise<OrderRefund> {
  return apiRequest<OrderRefund>(`admin/refunds/${id}/${step}`, { method: "POST" });
}

export function listReturns(query: Query): Promise<Page<ReturnRequest>> {
  return apiRequest<Page<ReturnRequest>>("admin/returns", { query });
}

export function returnAction(id: number, step: "approve" | "reject"): Promise<ReturnRequest> {
  return apiRequest<ReturnRequest>(`admin/returns/${id}/${step}`, { method: "POST" });
}

export function receiveReturn(id: number, resaleable: Record<number, boolean>): Promise<ReturnRequest> {
  return apiRequest<ReturnRequest>(`admin/returns/${id}/receive`, { method: "POST", json: { resaleable } });
}

export function completeReturn(id: number, refund_amount: string | null): Promise<ReturnRequest> {
  return apiRequest<ReturnRequest>(`admin/returns/${id}/complete`, { method: "POST", json: { refund_amount } });
}

export function listQuestions(query: Query): Promise<Page<ProductQuestion>> {
  return apiRequest<Page<ProductQuestion>>("admin/product-questions", { query });
}

export function answerQuestion(id: number, answer_text: string, is_public: boolean): Promise<ProductQuestion> {
  return apiRequest<ProductQuestion>(`admin/product-questions/${id}/answer`, {
    method: "POST",
    json: { answer_text, is_public },
  });
}

export function questionAction(id: number, step: "reject" | "toggle-public"): Promise<ProductQuestion> {
  return apiRequest<ProductQuestion>(`admin/product-questions/${id}/${step}`, { method: "POST" });
}

export function listAudit(query: Query): Promise<Page<AuditEntry>> {
  return apiRequest<Page<AuditEntry>>("admin/audit-log", { query });
}

export function listCities(provinceId?: number): Promise<City[]> {
  return apiRequest<City[]>("geo/cities", { query: { province_id: provinceId?.toString() } });
}

export function listProvinces(): Promise<Province[]> {
  return apiRequest<Province[]>("geo/provinces");
}

export function listShippingOptions(cityId: number): Promise<ShippingOption[]> {
  return apiRequest<ShippingOption[]>("shipping-methods", { query: { city_id: cityId.toString() } });
}

/** Bulk single-use codes; ``code`` is the prefix and the other fields are shared settings. */
export function generateDiscountCodes(data: Record<string, unknown>): Promise<unknown[]> {
  return apiRequest<unknown[]>("admin/discount-codes/generate", { method: "POST", json: data });
}
