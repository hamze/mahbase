import 'server-only';

/**
 * Forwards a browser request for ``/api/…`` or ``/media/…`` to Django unchanged (path with its trailing slash,
 * query, body, auth and session cookie), so the storefront and the API share one origin: the guest cart lives in
 * the backend session cookie and the bank returns the customer to this origin. Redirects (bank return) and
 * ``Set-Cookie`` are passed back as they are.
 */
const REQUEST_HEADERS = ['accept', 'authorization', 'content-type', 'cookie', 'idempotency-key', 'user-agent', 'x-forwarded-for'];
const RESPONSE_HEADERS = ['cache-control', 'content-disposition', 'content-type', 'etag', 'last-modified', 'location', 'vary'];

export async function forwardToBackend(request) {
  const { pathname, search, protocol } = request.nextUrl;
  const headers = new Headers({ 'x-forwarded-proto': protocol.replace(':', '') });
  REQUEST_HEADERS.forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:8000'}${pathname}${search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });
  const responseHeaders = new Headers();
  RESPONSE_HEADERS.forEach((name) => {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  });
  response.headers.getSetCookie().forEach((cookie) => responseHeaders.append('set-cookie', cookie));
  const hasNoBody = response.status === 204 || response.status === 304;
  return new Response(hasNoBody ? null : response.body, { status: response.status, headers: responseHeaders });
}
