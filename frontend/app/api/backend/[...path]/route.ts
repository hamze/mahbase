import { NextRequest } from "next/server";

import { backendFetch } from "@/lib/server/backend";
import { ACCESS_COOKIE } from "@/lib/server/config";

type Context = { params: Promise<{ path: string[] }> };

/** Forwards browser API calls to Django with the access token from the HttpOnly cookie. */
async function proxy(request: NextRequest, { params }: Context) {
  const { path } = await params;
  // Token endpoints stay server-side only (login, refresh and logout are handled by this app).
  if (path[0] === "auth" && path[1] !== "me") {
    return Response.json({ detail: "not_found" }, { status: 404 });
  }
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  const response = await backendFetch(
    `${path.join("/")}/${request.nextUrl.search}`,
    { method: request.method, headers, body },
    request.cookies.get(ACCESS_COOKIE)?.value,
  );
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
