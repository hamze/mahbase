import { BACKEND_URL } from "@/lib/server/config";

type Context = { params: Promise<{ path: string[] }> };

/** Serves uploaded media from Django at request time (BACKEND_URL is runtime config, unlike next.config rewrites). */
export async function GET(_: Request, { params }: Context) {
  const { path } = await params;
  const response = await fetch(`${BACKEND_URL}/media/${path.map(encodeURIComponent).join("/")}`);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": response.headers.get("cache-control") ?? "public, max-age=3600",
    },
  });
}
