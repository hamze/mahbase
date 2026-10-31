# Final Design — Concise v1.2

**Corrections applied:** currency is **Toman** everywhere (not Rial). Amounts use `BigIntegerField` in Toman; no decimals for money. Length reduced; everything not required by the original brief is dropped.

**Scope:** Users/Auth · Addresses · Cart · Reservation · Orders · Refunds/Returns · Q&A · Discount codes · Shipping methods · RBAC · Admin guides.

---

## 1. Auth (Django User + OTP + Simple JWT)

**User model:** `django.contrib.auth.User`
- `username` = normalized mobile (`09xxxxxxxxx`, unique)
- `first_name`, `last_name` separate
- `password` unused for customers (`set_unusable_password()`); used for Admin
- `is_active` = single source of truth for login eligibility
- `is_staff`, `is_superuser` for Admin Panel

**`UserProfile` (OneToOne):**
- `customer_tier` ∈ {`RETAIL`, `WHOLESALE`}
- `account_status` ∈ {`ACTIVE`, `BLOCKED`}
- `created_source` ∈ {`SELF_SIGNUP`, `ADMIN_CREATED`}

Invariant: `BLOCKED` ⇒ `is_active=False`. Deactivate = `is_active=False` + `ACTIVE`. Reactivate = both back to active.

**`OTPCode`:** `mobile`, `purpose` (`LOGIN`/`RESET_PASSWORD`), `code_hash`, `expires_at`, `consumed_at`, `attempts`.
Atomic verify: `SELECT FOR UPDATE` → reject if consumed/expired/maxed → increment attempts → if match, mark consumed and issue tokens.

**Tokens:** Simple JWT. Access 15–30 min, refresh 7–30 days, rotation + blacklist on logout.

**Storage (Next.js):** BFF pattern — browser ↔ Next.js route handlers ↔ Django. Access + refresh stored in `HttpOnly; Secure; SameSite=Lax` cookies. No token in JS.

**Endpoints:**
`POST /api/auth/otp/request` · `POST /api/auth/otp/verify` · `POST /api/auth/token/refresh` · `POST /api/auth/logout` · `POST /api/auth/password/reset/request` · `POST /api/auth/password/reset/confirm`.

---

## 2. Addresses (with Province/City + map)

**`Province`:** `name` unique, `is_active`.
**`City`:** `province_id`, `name`, `is_active`. Unique `(province, name)`.

**`Address`:** `user_id`, `title`, `receiver_name`, `receiver_mobile`, `province_id`, `city_id`, `address_line`, `postal_code`, `plaque`, `unit`, `latitude`, `longitude`, `is_default`, `deleted_at`.

Rules:
- Partial unique: one active default per user (`is_default=True AND deleted_at IS NULL`).
- `city.province_id == province_id`.
- Latitude/longitude must come together.
- Soft delete only. Orders snapshot address; edits never affect past orders.

**Endpoints:** `/api/me/addresses` (CRUD + `PATCH /{id}/default`), `GET /api/geo/provinces`, `GET /api/geo/cities?province_id=`.

**UI:** Province → City → text → map picker → save. “Use current location” optional.

---

## 3. Cart

**Guest:** session-only `{variant_id: quantity}`. No DB row, no `session_key`.

**`Cart`:** `user_id`, `status=ACTIVE`, timestamps. One active per user.
**`CartItem`:** `cart_id`, `variant_id`, `quantity`. Unique `(cart, variant)`. **Prices never stored.**

**On login — merge (single transaction):**
1. `merged = db_qty + session_qty` per variant.
2. `SELECT FOR UPDATE` on variant; `merged = min(merged, max_purchase, available_quantity)`, round down to `purchase_step`.
3. If `merged < min_purchase` → drop with warning.
4. Persist; clear session.

**Revalidation:** on merge; on `GET /api/cart` (with per-line warnings); authoritatively inside order creation (§4).

**Endpoints:** `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/{id}`, `DELETE /api/cart/items/{id}`, `DELETE /api/cart`.

---

## 4. Reservation & Order creation (explicit flow)

**No `Reservation` table.** Reservation lives on:
- `ProductVariant`: `stock_quantity`, `reserved_quantity` (available = difference).
- `Order`: `reservation_expires_at`, `stock_reservation_status` ∈ {`RESERVED`, `CONVERTED`, `RELEASED`}.

**`POST /api/orders` with `Idempotency-Key` — single transaction:**

1. Insert `Order` (`PENDING_PAYMENT`, `UNPAID`, `RESERVED`, TTL). On `(user, idempotency_key)` collision → return existing order (`200`).
2. Load user's cart; empty → `422`.
3. **Lock all variants in ascending `variant_id` order** (`SELECT FOR UPDATE`). For each:
   - Check `qty > 0`, multiple of `purchase_step`, `min_purchase ≤ qty ≤ max_purchase`, `qty ≤ available`.
   - Recompute `unit_price` from variant + tier. **Client prices ignored.**
   - Any failure → **rollback everything** (order row, all locks). Return `409` with per-line errors.
4. Lock and validate `DiscountCode` (§9). Failure → rollback all.
5. Create `OrderItem` rows with snapshots.
6. Create `OrderAddressSnapshot` from `address_id` (validated to belong to user).
7. Compute discount, resolve shipping (must be active + match `city_id`), compute totals.
8. `reserved_quantity += qty` per item (variants already locked).
9. `DiscountCode.used_count += 1`, `Order.coupon_consumed = True`.
10. Clear cart. **Commit.**

No partial state on failure — rollback guarantees `reserved_quantity`, `used_count`, and cart are untouched.

---

## 5. Payment, expiry, late payments

### 5.1. Payment confirmation (atomic)

`POST /api/payments/callback` — single transaction:
1. `SELECT FOR UPDATE` on `Order`.
2. **Idempotency:** existing `PaymentTransaction.idempotency_key` → return stored response.
3. **Duplicate gateway txn:** look up `(gateway, gateway_transaction_id)`:
   - Same order → idempotent success.
   - **Different order → reject (`409`), log alert.** Never silently treated as duplicate.
4. Branch on `stock_reservation_status`:
   - `CONVERTED` → idempotent success.
   - `RELEASED` → **refund + exit** (§5.3).
   - `RESERVED` → continue.
5. Lock variants (ascending id) → `reserved_quantity -= qty`, `stock_quantity -= qty`.
6. Insert `PaymentTransaction(SUCCESS)`.
7. `payment_status=PAID`, `stock_reservation_status=CONVERTED`, `order_status → IN_PREPARATION`.
8. Commit.

### 5.2. Late-payment policy

**Rule:** Payment is accepted iff at the moment of `SELECT FOR UPDATE`, `stock_reservation_status == RESERVED` — regardless of `paid_at` vs. `reservation_expires_at`. Rationale: stock is still held for this order; accepting a real payment is safer than refunding while holding.

- If `paid_at > reservation_expires_at` and accepted → emit `late_payment_accepted` metric (informs Celery tuning, does not change behavior).
- If `RELEASED` (§5.3) → refund.

### 5.3. Rejection after release

1. Insert `PaymentTransaction(status=REJECTED_AFTER_RELEASE)`.
2. Create `OrderRefund(reason=PAYMENT_AFTER_RELEASE, status=APPROVED)` → initiate gateway refund.
3. Order unchanged (`payment_status=UNPAID`, `order_status=CANCELLED`, `stock_reservation_status=RELEASED`).

### 5.4. Expiry (atomic)

Celery beat every 30–60s. Per order in single transaction:
1. Lock order. If `stock_reservation_status != RESERVED` → no-op.
2. If `payment_status NOT IN (UNPAID, PENDING)` → no-op (payment handler won).
3. Lock variants ascending → `reserved_quantity -= qty`.
4. `stock_reservation_status=RELEASED`, `order_status=CANCELLED`, `cancellation_reason=RESERVATION_EXPIRED`.
5. `DiscountCode.used_count -= 1`, `coupon_consumed = False`.
6. Commit.

Index on `reservation_expires_at`.

### 5.5. Traceability (corrected)

`ProductVariant.reserved_quantity` = Σ `OrderItem.quantity` for orders with **`stock_reservation_status == RESERVED`**, **including expired-but-not-yet-released orders**. Once status becomes `CONVERTED` or `RELEASED`, the order drops out. Optional daily reconciliation alerts on drift.

### 5.6. Race prevention

Payment (§5.1) and expiry (§5.4) both lock the `Order` row first, then check `stock_reservation_status` inside the lock, then lock variants. Whichever commits first wins; the other sees updated status and returns idempotent / no-op. No double-decrement possible.

---

## 6. Order & OrderItem

**`Order`:** `order_number`, `idempotency_key` (unique per user), `user_id`, `customer_tier_snapshot`, `order_status`, `payment_status`, `subtotal_products`, `product_discount_total`, `discount_code_id`, `discount_code_snapshot`, `discount_amount`, `coupon_consumed`, `shipping_method_name_snapshot`, `shipping_cost`, `shipping_discount_amount`, `other_costs`, `payable_total`, `paid_total`, `refunded_total`, `reservation_expires_at`, `stock_reservation_status`, `placed_at`, `cancelled_at`, `cancellation_reason`.

**`OrderAddressSnapshot`:** `receiver_name`, `receiver_mobile`, `province_name`, `city_name`, `address_line`, `postal_code`, `plaque`, `unit`, `latitude`, `longitude`. No FK to `Address`.

**`OrderItem`:**
`product_id` (SET_NULL), `variant_id` (SET_NULL), `product_name_snapshot`, `variant_label_snapshot`, `sku_snapshot`, `unit_name_snapshot`, `quantity`, `original_unit_price_snapshot`, `unit_price` (post-product-discount), `product_discount_per_unit`, `line_product_discount_total`, `line_total` (excludes code discount), `preparation_status`, `returned_quantity`, `restocked_at`.

**Total math (no double count):**
- `subtotal_products` = Σ `line_total` (net of product discounts).
- `product_discount_total` = Σ `line_product_discount_total` (informational).
- `discount_amount` = code discount on eligible subtotal.
- `payable_total = subtotal_products − discount_amount + shipping_cost − shipping_discount_amount + other_costs`.
- All amounts integer Toman.

**Status transitions (enforced via `transition_*` services, `409` on invalid):**

`order_status`:
- `PENDING_PAYMENT → IN_PREPARATION` (payment success)
- `PENDING_PAYMENT → CANCELLED` (admin unpaid cancel / expiry)
- `IN_PREPARATION → READY_TO_SHIP → SHIPPED → DELIVERED`
- `IN_PREPARATION | READY_TO_SHIP → CANCELLED` **only via `OrderRefund` completion**
- `DELIVERED → RETURNED` **only via `ReturnRequest` completion**
- **`SHIPPED → CANCELLED` is forbidden** (must deliver first, then return).

`payment_status`: `UNPAID → PENDING → PAID | FAILED`; `FAILED → PENDING` (retry); `PAID → PARTIALLY_REFUNDED → REFUNDED`.

`stock_reservation_status`: only `RESERVED → CONVERTED` (payment) or `RESERVED → RELEASED` (expiry / unpaid cancel).

**Rule:** `order_status=CANCELLED` with `payment_status=PAID` is invalid.

**Endpoints:** `POST /api/orders`, `GET /api/me/orders`, `GET /api/me/orders/{n}`, `POST /api/me/orders/{n}/refund-request`, `POST /api/me/orders/{n}/return-request`; admin CRUD at `/api/admin/orders/*` (including `items/{id}/preparation-status`, `cancel`), `/api/admin/refunds/*`, `/api/admin/returns/*`.

---

## 7. Refunds & Returns (separate workflows)

Plain `order_status` change is **never** enough for a paid order.

**`OrderRefund`:** `order_id`, `amount` (Toman), `reason` (`ADMIN_CANCEL_BEFORE_SHIP`/`RETURN`/`PAYMENT_AFTER_RELEASE`), `status` (`REQUESTED → APPROVED → PROCESSING → COMPLETED` / `FAILED` / `REJECTED`), `requested_by_user_id`, `approved_by_user_id`, `gateway_refund_id`, timestamps.

**On `COMPLETED` (single transaction):**
1. `refunded_total += amount`.
2. `payment_status → REFUNDED` (full) or `PARTIALLY_REFUNDED` (partial).
3. `ADMIN_CANCEL_BEFORE_SHIP`: → `order_status=CANCELLED`; `stock_quantity += qty` per item (goods never shipped); `restocked_at=now`.
4. `RETURN`: per-item restock handled by `ReturnRequestItem.resaleable` (§7.2); `order_status → RETURNED` when all refundable items accounted.
5. `PAYMENT_AFTER_RELEASE`: no order-status change.
6. Coupon: if `DiscountCode.release_on_refund=True` **and** fully refunded → `used_count -= 1`, `coupon_consumed = False`. Default `False`.

Approval and gateway refund are separate steps; only on gateway success does status become `COMPLETED`.

**`ReturnRequest`:** `order_id`, `reason`, `status` (`REQUESTED → APPROVED → RECEIVED → COMPLETED` / `REJECTED` / `CANCELLED`), `refund_amount`, `order_refund_id`.
**`ReturnRequestItem`:** `return_request_id`, `order_item_id`, `quantity`, `resaleable` (null until `RECEIVED`).

Flow: customer or admin opens → admin approves → customer ships → admin marks `RECEIVED` and sets `resaleable` per item → admin completes → `OrderRefund(RETURN)` created → refund flow → on completion:
- `resaleable=True` → `stock_quantity += qty`, `OrderItem.returned_quantity += qty`, `restocked_at=now`.
- `resaleable=False` → only `returned_quantity` tracked.

Admin-only approvals; decisions recorded in audit log.

---

## 8. Q&A

**`FAQCategory`:** `title`, `sort_order`, `is_active`.
**`FAQ`:** `category_id`, `question`, `answer` (HTML sanitized), `is_active`, `sort_order`, `created_by_admin`.
**`ProductQuestion`:** `product_id`, `user_id` (null if admin-created), `question_text`, `answer_text` (HTML sanitized, null), `status` (`PENDING`/`ANSWERED`/`REJECTED`), `created_by_type`, `answered_by_user_id`, `answered_at`, `is_public`.

Rules: `ANSWERED` ⇒ `answer_text` and `answered_at` non-null. Public display only `ANSWERED` + `is_public`. Rich text sanitized via allowlist.

**Endpoints:** `GET /api/faqs`, `/api/faq-categories`, `GET/POST /api/products/{id}/questions`; admin CRUD + moderation.

---

## 9. Discount codes (no redemption table)

**`DiscountCode`:** `code` (unique), `product_discount_type` (`NONE`/`FIXED_AMOUNT`/`PERCENTAGE`), `amount`, `percentage`, `max_discount_amount` (null = no cap), `free_shipping` (combinable), `category_id` (null = all), `min_eligible_subtotal`, `starts_at`, `ends_at` (null = indefinite), `usage_limit_total`, `used_count`, `per_user_limit` (default 1), `specific_mobile`, `is_active`, `release_on_refund` (default `False`).

**Category eligibility:**
- Null → all.
- Main category → **includes its subcategories** (2-level max).
- Subcategory → only itself.
- Eligible line: `product.category_id == code.category_id OR product.category.parent_id == code.category_id`.

**Calculation:** after product-level variant discount (`line_total`), on `eligible_subtotal`:
- `FIXED`: `min(amount, eligible_subtotal)`.
- `PERCENTAGE`: `min(percentage × eligible_subtotal / 100, max_discount_amount (if set), eligible_subtotal)`.
- `free_shipping=True` → `shipping_discount_amount = shipping_cost`.
- Reject if `eligible_subtotal < min_eligible_subtotal`.

**Usage — single source of truth = `Order.coupon_consumed`:**

| Event | `coupon_consumed` | `used_count` |
|---|---|---|
| Order created with code | `True` | +1 |
| Reservation expiry / unpaid cancel | `False` | −1 |
| Full refund, `release_on_refund=True` | `False` | −1 |
| Full refund, `release_on_refund=False` (default) | stays `True` | unchanged |
| Partial refund | stays `True` | unchanged |

- `per_user_limit` counts orders with `coupon_consumed=True` for that user + code. **Consistent with refund policy** — refunded-but-retained codes still count toward per-user and global limits.
- `POST /api/discounts/validate` never mutates state.

**Endpoints:** `POST /api/discounts/validate`; admin CRUD `/api/admin/discount-codes`; `/api/admin/discount-codes/generate` (bulk N single-use).

---

## 10. Shipping methods

**`ShippingMethod`:** `name`, `description`, `price` (Toman), `applies_to_all_cities`, `is_active`, `sort_order`.
**`ShippingMethodCity`:** `shipping_method_id`, `city_id`. Unique `(shipping_method, city)`. At least one when `applies_to_all_cities=False`.

Checkout filters by `address.city_id`; `shipping_cost` snapshotted into order. `free_shipping` discount zeroes the chosen cost. Deactivation via `is_active=False`; never hard-delete if referenced.

**Endpoints:** `GET /api/shipping-methods?city_id=`; admin CRUD + `/cities` assignment.

---

## 11. `PaymentTransaction`

`order_id`, `idempotency_key` (unique), `gateway`, `gateway_transaction_id`, `amount` (Toman), `currency="IRT"`, `method`, `status` (`INITIATED`/`PENDING`/`SUCCESS`/`FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`/`REJECTED_AFTER_RELEASE`/`DUPLICATE_REJECTED`), `paid_at`, `created_at`, `raw_response` (sanitized).

Unique `(idempotency_key)` and `(gateway, gateway_transaction_id)`. Amount and currency immutable.

---

## 12. RBAC

Two roles: **Customer**, **Admin**. No Supplier.

**Admin access:** `is_staff=True` **and** specific permission codename (or `is_superuser=True`).

| Permission | Customer | Admin |
|---|---|---|
| auth (OTP / reset) | ✅ | ✅ |
| `users.manage_self` | ✅ | ✅ |
| `addresses.manage_self` | ✅ | ❌ |
| `cart.manage_self` | ✅ | ❌ |
| `orders.create_self` / `view_self` / `request_refund` / `request_return` | ✅ | ❌ |
| `admin.users.*` (view/create/edit/tier/block) | ❌ | ✅ |
| `admin.orders.*` (view_all/create/edit/status/cancel) | ❌ | ✅ |
| `admin.refunds.approve` / `complete` | ❌ | ✅ |
| `admin.returns.approve` / `receive` / `complete` | ❌ | ✅ |
| `admin.discounts.manage` | ❌ | ✅ |
| `admin.shipping.manage` | ❌ | ✅ |
| `admin.faqs.manage` | ❌ | ✅ |
| `admin.product_questions.answer` | ❌ | ✅ |
| `admin.audit.view` | ❌ | ✅ |

**Conditional UI:** customers see only their own data; admin buttons render only when the permission is present.

---

## 13. Admin Panel Guides (one line per section)

- **کاربران:** مدیریت کاربران، تغییر نوع عادی/عمده، مسدودسازی، مشاهده سوابق. موبایل شناسه اصلی ورود است.
- **آدرس‌ها:** آدرس‌ها با موقعیت نقشه ذخیره می‌شوند؛ ویرایش/حذف آن‌ها روی سفارش‌های قبلی اثری ندارد.
- **سبد خرید:** سبد مهمان فقط در session؛ بعد از ورود به سبد دیتابیس منتقل/ادغام می‌شود.
- **سفارش‌ها:** وضعیت سفارش و پرداخت مستقل‌اند؛ رزرو موجودی از روی اقلام سفارش‌های در انتظار پرداخت قابل ردیابی است.
- **مرجوعی و لغو پرداخت‌شده:** گردش‌کار مستقل با تأیید ادمین؛ تغییر وضعیت صرف مجاز نیست.
- **پرسش و پاسخ:** ثبت و پاسخ پرسش‌های متداول و پرسش محصولات؛ پاسخ‌ها قبل از انتشار پاک‌سازی می‌شوند.
- **کد تخفیف:** نوع تخفیف، دسته (دسته اصلی شامل زیردسته‌ها)، کف مبلغ، سقف، بازه اعتبار، محدودیت‌ها و سیاست بازگشت پس از استرداد.
- **روش ارسال:** قیمت و شهرهای مجاز؛ در حالت «همه شهرها» خاموش، حداقل یک شهر باید انتخاب شود.


**Expected Output:** Complete backend code (models, APIs, permissions, sanitization, validations) and a working Next.js frontend admin panel with integrated help texts.