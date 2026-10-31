# Mahbase — catalog & product admin

Single-store catalog: Django + Django REST Framework + Simple JWT on PostgreSQL (`backend/`) and a Persian RTL
Next.js admin panel (`frontend/`). Django is the authority for validation, data integrity and permissions; the
Next.js app only renders, and hides controls the user cannot use.

## Layout

| Path | Contents |
|---|---|
| `backend/config/` | Django settings (env driven, console logging), URLs |
| `backend/catalog/` | Models (`models/`), serializers, views, RBAC permission, Django Admin, media cleanup |
| `backend/accounts/` | JWT endpoints and `GET /api/auth/me/` |
| `frontend/` | Next.js 15 admin (App Router) |
| `nginx/` | Reverse proxy serving Django static/media in the Compose stack |

## Configuration

Copy `.env.example` to `.env` and set at least `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`. All settings are
environment variables; nothing secret is committed.

## Running with Docker Compose (production-like)

```bash
cp .env.example .env        # edit secrets
docker compose up --build -d
docker compose exec backend python manage.py createsuperuser
```

| Service | Container | Host port | Purpose |
|---|---|---|---|
| `db` | `mahbase-db` | `5433` | PostgreSQL 16 |
| `backend` | `mahbase-backend` | `8000` | Django/gunicorn (runs migrations and collectstatic on start) |
| `proxy` | `mahbase-proxy` | `8080` | nginx: `/static/`, `/media/`, proxies API and `/admin/` |
| `frontend` | `mahbase-frontend` | `3000` | Next.js admin — open http://localhost:3000/manage |

Django Admin: http://localhost:8080/admin/. All services share the `mahbase` network.

The auth cookies are `Secure` by default. Browsers accept secure cookies on `http://localhost`, but on any other plain
HTTP host set `COOKIE_SECURE=false` for testing only; production must run behind HTTPS.

## Local development

```bash
docker compose up -d db                                   # PostgreSQL on localhost:5433

cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export DJANGO_SECRET_KEY=dev DJANGO_DEBUG=true POSTGRES_PASSWORD=<from .env> POSTGRES_PORT=5433
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver                      # http://localhost:8000 (also serves /media, see DJANGO_SERVE_MEDIA)

cd ../frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev             # http://localhost:3000/manage
```

Checks: `python manage.py test catalog` (needs PostgreSQL; the tests use row locks), `npm run lint`, `npm run build`.

## Roles and permissions

API access requires an authenticated **staff** user. Write actions additionally need the RBAC permission below,
stored as Django permissions `catalog.<name with "_">` (for example `products.edit_price` →
`catalog.products_edit_price`). Grant them through Groups (roles) in Django Admin; superusers have all of them.

| Permission | Allows |
|---|---|
| `categories.manage`, `tags.manage`, `brands.manage`, `attributes.manage`, `units.manage` | Create/update/delete that metadata (attribute options use `attributes.manage`) |
| `media.manage` | `POST /api/media/upload/` |
| `products.create` / `products.edit` | Create products / update products and add or update variants |
| `products.publish` | `PATCH /api/products/{id}/toggle-publish/` |
| `products.delete` | Soft delete and restore |
| `products.edit_price` | Any write to `base_price`, `wholesale_price`, `discount_percentage`, `is_discount_active`; `PATCH /api/variants/{id}/price/` and `POST /api/variants/adjust-prices/` |
| `products.edit_stock` | Initial stock on variant creation and `PATCH /api/variants/{id}/stock/` |

The admin UI reads the current user's permission names from `GET /api/auth/me/` and only uses them to show or hide
controls.

## Authentication and token lifecycle

1. The login form posts to a Next.js server action, which calls `POST /api/auth/token/` and stores the access and
   refresh tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Tokens are never exposed to browser JavaScript.
2. The browser calls the same-origin proxy `/api/backend/...`; the proxy adds `Authorization: Bearer <access>` and
   forwards to Django, which validates the token and permissions on every request. Token endpoints are not
   reachable through the proxy.
3. Access tokens live `JWT_ACCESS_MINUTES` (default 5 min). The access cookie expires a little earlier
   (`JWT_ACCESS_COOKIE_SECONDS`, default 240 s); when it is gone, the Next.js middleware calls
   `POST /api/auth/token/refresh/` before the request continues.
4. Refresh tokens live `JWT_REFRESH_DAYS` (default 1 day) and **rotate**: each refresh returns a new refresh token and
   blacklists the old one (`rest_framework_simplejwt.token_blacklist`). If two requests refresh at the same moment,
   the loser gets 401 and the browser client retries once with the new cookies.
5. Logout blacklists the refresh token (`POST /api/auth/logout/`) and deletes both cookies. Deactivating a user or
   revoking permissions takes effect on the next request because Django checks them on every call.

Run `python manage.py flushexpiredtokens` periodically to prune expired blacklist rows.

## API notes

Endpoints follow the catalog specification (section 7). Behaviour worth knowing:

- **Metadata DELETE** (`categories`, `tags`, `brands`, `units`, `attributes`, attribute `options`): an unreferenced row
  is deleted (`204`). A row still used by products (or a category with subcategories) is **deactivated** instead and
  the response is `200 {"id": …, "deactivated": true}`. Inactive entries stay on products that already use them but
  cannot be newly assigned. Hard deletion of referenced rows is blocked at the database level (`PROTECT`).
- **Products** are never hard-deleted: `DELETE /api/products/{id}/` sets `deleted_at`, `PATCH …/restore/` clears it;
  publication is independent and changes only via `toggle-publish`. New products start unpublished.
  `GET /api/products/` hides deleted products unless `?deleted=true` (only deleted) or `?deleted=all`; other filters:
  `category` (includes subcategories), `brand`, `tag`, `is_published`, `search`, `page`, `page_size`.
- **Variants**: `POST /api/products/` requires at least one variant. Variant attributes and `combination_hash` are
  written in one transaction; duplicate combinations are rejected (and enforced by a unique constraint).
  `PATCH /api/variants/{id}/stock/` takes `{"stock_quantity": "…"}` or `{"delta": "…"}` and runs under
  `SELECT … FOR UPDATE`; stock never goes below zero.
  `PATCH /api/variants/{id}/price/` updates only the price fields (and writes only those columns).
- **Bulk price adjustment**: `POST /api/variants/adjust-prices/` with `{"percentage": "10", "category": <id|null>}`
  multiplies `base_price` and `wholesale_price` of every variant (or those in the category and its subcategories,
  including soft-deleted products) by `1 + percentage/100` in one `UPDATE`, rounded to the nearest 1,000 Toman (half away from zero). `percentage` is
  between `-99.99` and `999.99`; discounts and stock are unchanged. Returns `{"updated": <variant count>}`.
- **Product media**: `PUT/PATCH /api/products/{id}/` claims new temporary uploads listed in `media` and detaches
  the product's assets listed in `remove_media` (ids) in the same transaction; detached assets become temporary
  and are removed by cleanup.
- **Brand/tag availability** (`GET /api/brands/?category=`, `GET /api/tags/?category=` and product validation):
  a brand or tag with **no categories** applies to every category, present and future. A brand or tag linked to a
  main category also applies to all its subcategories (a subcategory link applies to that subcategory only). The rule lives on `Brand.for_category` / `Tag.for_category`.
- **Category change** on a product re-validates brand, tags, descriptive attribute values and existing variant
  attributes against the new category.
- Validation errors are `400` with DRF's field → messages shape; a concurrent constraint conflict is `409`.
- Order entities are out of scope. When orders are added they must store product/variant snapshots and reference
  variants with `PROTECT`, which is compatible with soft-deleted products and deactivated metadata.

## Media lifecycle

- Uploads are verified with Pillow (real format JPEG/PNG/WebP/GIF, size `MEDIA_MAX_UPLOAD_BYTES`, dimensions
  `MEDIA_MIN_DIMENSION`–`MEDIA_MAX_DIMENSION`) and re-encoded to WebP.
- An upload without an owner is **temporary**: `image_type=temporary`, no owner, `temporary_since` set. Rich-text
  images, product images and new brand logos start this way and are **claimed** when the product/brand is saved: in
  the same transaction the rows are locked, re-checked to still be temporary, and given their type and owner.
- A database check constraint enforces that temporary media has no owner and active media has exactly one owner
  compatible with its type (product images → product, `brand_logo` → brand, `category_icon` → category).
- Files are stored under `products/<id>/`, `brands/<id>/`, `categories/<id>/` when uploaded for an owner, and under
  `temporary/` otherwise; claimed files keep their path because product descriptions already reference the URL.
  Storage uses Django's default file storage (`STORAGES`), so switching to an object store is a settings change.
- Deleting a brand or category releases its media back to temporary so the files are removed by cleanup.
- Django serves `MEDIA_URL` itself whenever `DJANGO_SERVE_MEDIA=true` (default), independent of `DEBUG`; in the
  Compose stack nginx answers `/media/` first. The admin loads images through its `/media/…` route, which proxies to
  `BACKEND_URL`.

## Admin panel

All admin pages live under `/manage` (`/manage/login`, `/manage/products`, `/manage/stock`, `/manage/pricing`, …);
`/` redirects to `/manage`. The UI is Persian/RTL with the self-hosted Vazirmatn font (npm `vazirmatn`).

- **Stock & price** (`/manage/stock`): search a product and edit stock (absolute value) and prices of all its
  variants in one table. After creation this is the only place stock and prices are changed; the product edit
  page covers metadata, attributes, images and variant SKU/purchase limits.
- **Bulk price adjustment** (`/manage/pricing`): percentage change of all prices or one category (inflation updates).

### Cleanup

```bash
python manage.py cleanup_media      # or: docker compose exec backend python manage.py cleanup_media
```

Schedule it (for example hourly via cron). It selects temporary, ownerless assets whose `temporary_since` is older
than `MEDIA_TEMPORARY_RETENTION_HOURS` (default 24 h), then for each one re-checks those conditions under a row lock
that skips rows a claim currently holds. Active media and media being claimed are therefore never removed. The file
is deleted first; if that fails, the error is logged and the row stays temporary so the next run retries it.
