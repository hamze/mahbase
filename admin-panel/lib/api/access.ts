import { apiRequest, Page } from "@/lib/api/client";
import type { AccessGroup, AccessPermission, AccessUser } from "@/lib/api/types";

type Query = Record<string, string | undefined>;
type GroupWrite = Pick<AccessGroup, "name" | "slug" | "description_fa"> & { permissions?: string[] };

export async function listPermissions(): Promise<AccessPermission[]> {
  return (await apiRequest<Page<AccessPermission>>("access/permissions", { query: { page_size: "500" } })).results;
}

export async function listGroups(): Promise<AccessGroup[]> {
  return (await apiRequest<Page<AccessGroup>>("access/groups", { query: { page_size: "500" } })).results;
}

export function getGroup(id: number): Promise<AccessGroup> {
  return apiRequest<AccessGroup>(`access/groups/${id}`);
}

export function createGroup(data: GroupWrite): Promise<AccessGroup> {
  return apiRequest<AccessGroup>("access/groups", { method: "POST", json: data });
}

/** PUT with ``permissions`` replaces the whole permission set in one transaction. */
export function updateGroup(id: number, data: GroupWrite): Promise<AccessGroup> {
  return apiRequest<AccessGroup>(`access/groups/${id}`, { method: "PUT", json: data });
}

export function deleteGroup(id: number): Promise<null> {
  return apiRequest<null>(`access/groups/${id}`, { method: "DELETE" });
}

export function listAccessUsers(query: Query): Promise<Page<AccessUser>> {
  return apiRequest<Page<AccessUser>>("access/users", { query });
}

export function setAccessUserGroup(id: number, group: number | null): Promise<AccessUser> {
  return apiRequest<AccessUser>(`access/users/${id}/group`, { method: "PATCH", json: { group } });
}

export function toggleAccessUserActive(id: number): Promise<AccessUser> {
  return apiRequest<AccessUser>(`access/users/${id}/toggle-active`, { method: "PATCH" });
}
