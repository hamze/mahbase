import './globals.css';

import { HydrationBoundary } from '@tanstack/react-query';
import { internalPagesQuery, storeSettingsQuery } from '@/api/queries';
import { prefetchPage, siteUrl, storeSettings } from '@/lib/server-data';
import Providers from './providers';

export async function generateMetadata() {
  const settings = await storeSettings();
  const name = settings.store_name;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: name, template: `%s | ${name}` },
    description: `فروشگاه اینترنتی ${name}`,
    applicationName: name,
    manifest: '/manifest.json',
    icons: { icon: settings.logo_url || '/icon.svg' },
    openGraph: { siteName: name, locale: 'fa_IR', type: 'website' },
  };
}

export const viewport = { themeColor: '#9E2A2B' };

// Rendered per request: prices, stock and content come live from the backend (and it is not reachable at build time).
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  const { state } = await prefetchPage([storeSettingsQuery(), internalPagesQuery()]);
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        <Providers>
          <HydrationBoundary state={state}>{children}</HydrationBoundary>
        </Providers>
      </body>
    </html>
  );
}
