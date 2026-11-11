import { siteUrl } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/cart', '/checkout', '/login'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
