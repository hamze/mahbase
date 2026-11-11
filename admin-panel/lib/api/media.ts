import { apiRequest } from "@/lib/api/client";
import type { MediaAsset } from "@/lib/api/types";

/** Upload without an owner: the backend stores it as TEMPORARY until a product or brand claims it. */
export function uploadTemporaryImage(file: File, altText = ""): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("alt_text", altText);
  return apiRequest<MediaAsset>("media/upload", { method: "POST", formData });
}

export function uploadCategoryIcon(categoryId: number, file: File): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", String(categoryId));
  formData.append("image_type", "category_icon");
  return apiRequest<MediaAsset>("media/upload", { method: "POST", formData });
}
