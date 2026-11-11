import { apiRequest, Page } from "@/lib/api/client";
import type { BlogCategory, BlogPost, BlogPostStatus, BlogPostWrite } from "@/lib/api/types";

type Query = Record<string, string | undefined>;

export async function listBlogCategories(): Promise<BlogCategory[]> {
  return (await apiRequest<Page<BlogCategory>>("admin/blog/categories", { query: { page_size: "500" } })).results;
}

export function listBlogPosts(query: Query): Promise<Page<BlogPost>> {
  return apiRequest<Page<BlogPost>>("admin/blog/posts", { query });
}

export function getBlogPost(id: number): Promise<BlogPost> {
  return apiRequest<BlogPost>(`admin/blog/posts/${id}`);
}

export function saveBlogPost(id: number | null, data: BlogPostWrite): Promise<BlogPost> {
  return id
    ? apiRequest<BlogPost>(`admin/blog/posts/${id}`, { method: "PUT", json: data })
    : apiRequest<BlogPost>("admin/blog/posts", { method: "POST", json: data });
}

export function setBlogPostStatus(id: number, status: BlogPostStatus): Promise<BlogPost> {
  return apiRequest<BlogPost>(`admin/blog/posts/${id}/publish`, { method: "PATCH", json: { status } });
}

/** Soft delete; refused for internal pages linked from the site menu. */
export function deleteBlogPost(id: number): Promise<null> {
  return apiRequest<null>(`admin/blog/posts/${id}`, { method: "DELETE" });
}
