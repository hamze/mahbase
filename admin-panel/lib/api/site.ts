import { apiRequest, Page } from "@/lib/api/client";
import type {
  ContactMessage,
  ContactMessageStatus,
  Notification,
  NotificationStatus,
  ProductReview,
  StoreSettings,
} from "@/lib/api/types";

type Query = Record<string, string | undefined>;

export function listNotifications(query: Query): Promise<Page<Notification>> {
  return apiRequest<Page<Notification>>("notifications", { query });
}

export function setNotificationStatus(id: number, status: NotificationStatus): Promise<Notification> {
  return apiRequest<Notification>(`notifications/${id}/status`, { method: "PATCH", json: { status } });
}

export function listReviews(query: Query): Promise<Page<ProductReview>> {
  return apiRequest<Page<ProductReview>>("reviews", { query });
}

export function approveReview(id: number): Promise<ProductReview> {
  return apiRequest<ProductReview>(`reviews/${id}/approve`, { method: "PATCH" });
}

export function rejectReview(id: number, reject_reason: string): Promise<ProductReview> {
  return apiRequest<ProductReview>(`reviews/${id}/reject`, { method: "PATCH", json: { reject_reason } });
}

export function deleteReview(id: number): Promise<null> {
  return apiRequest<null>(`reviews/${id}`, { method: "DELETE" });
}

export function listContactMessages(query: Query): Promise<Page<ContactMessage>> {
  return apiRequest<Page<ContactMessage>>("contact-messages", { query });
}

export function setContactMessageStatus(id: number, status: ContactMessageStatus, note = ""): Promise<ContactMessage> {
  return apiRequest<ContactMessage>(`contact-messages/${id}/status`, { method: "PATCH", json: { status, note } });
}

export function getStoreSettings(): Promise<StoreSettings> {
  return apiRequest<StoreSettings>("admin/settings");
}

/** Full PUT; Django validates the JSON fields and rejects unknown keys. */
export function saveStoreSettings(data: Omit<StoreSettings, "logo_url">): Promise<StoreSettings> {
  return apiRequest<StoreSettings>("settings", { method: "PUT", json: data });
}
