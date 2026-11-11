# Storefront

Persian RTL customer storefront and user panel (Next.js App Router, JavaScript). Every piece of data comes from the
Django backend through the central client in `src/api/client.js` and the feature modules next to it; the API
contract the pages use is summarised in `.ai/work/storefront/api.md`.

## How it renders

- **Public pages are server-rendered** (home, products and categories, product, blog, blog post, FAQ, internal
  pages, contact): each `src/app/(store)/**/page.jsx` prefetches its data on the server with the same React Query
  definitions the browser uses (`src/api/queries.js`) and passes the cache down with `HydrationBoundary`, so the
  HTML search engines get already holds the content. Pages export `generateMetadata` (title, description,
  canonical, Open Graph from the backend's SEO fields) and JSON-LD (Product, BlogPosting, FAQPage).
  `sitemap.xml` and `robots.txt` are generated from the API (`src/app/sitemap.js`, `robots.js`).
- **Customer pages** (cart, checkout, account, orders, login) render in the browser and are `noindex`; the session
  token stays in the browser (`src/api/client.js`), so the server always renders as an anonymous visitor.
  Catalog query keys carry the price tier, so a wholesale customer's browser fetches its own prices.
- **Same origin**: `src/app/api/[...path]` and `src/app/media/[...path]` forward `/api/…` and `/media/…` to the
  backend unchanged (`src/lib/backend-proxy.js`): the guest cart lives in the backend session cookie and the bank
  returns the customer to this origin.
- The views in `src/views/` are client components; `src/app/` holds only routes, layouts and metadata.

## Running

- Environment (`.env.example`): `BACKEND_URL` (Django, default http://localhost:8000) and `STOREFRONT_URL` (public
  origin for canonical URLs and the sitemap). Both are read at runtime.
- Development: `npm install && npm run dev` (http://localhost:5173).
- Production: `docker compose up frontend` (Next.js standalone server on port 3000, published as 8081).
- Checks: `npm run lint`, `npm run build`.
