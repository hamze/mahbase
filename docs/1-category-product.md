# E-Commerce Domain Specification: Catalog & Products
Project: General-Purpose Single-Store E-Commerce
Phase: Analysis & Domain Modeling (Final Version 7.0)
Language/Localization: Persian (RTL) / Persian-only Site

## 1. Core Domain Entities & Relationships

### 1.1. Category & Subcategory
*   **Logic:** Hierarchical structure with a **maximum of 2 levels** (Main Category -> Subcategory).
*   **Server-Side Validation:** The 2-level limit is enforced in the backend (e.g., `clean()` method). A Subcategory cannot have a parent that already has a parent.
*   **Fields:** `id`, `name` (Persian), `slug` (English, **DB Unique Constraint**), `parent_id` (FK, Nullable), `is_active`, `sort_order`, `seo_title`, `seo_description`.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت دسته‌بندی‌ها
    *   *Description:* دسته‌بندی‌ها ساختار اصلی منوی سایت شما را تشکیل می‌دهند. شما می‌توانید دسته‌های اصلی و زیردسته‌ها را تعریف کنید (حداکثر ۲ سطح).
    *   *Example:* دسته اصلی "مواد غذایی" → زیردسته "گوشت و مرغ".

### 1.2. Tag
*   **Logic:** Cross-cutting labels. Pre-defined by Admin. Linked to Categories (M2M).
*   **Fields:** `id`, `name` (Persian), `slug` (English, **DB Unique Constraint**), `is_featured` (Boolean), `is_active` (Boolean), `categories` (M2M).
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت تگ‌ها (برچسب‌ها)
    *   *Description:* تگ‌ها برچسب‌های کوتاه برای فیلتر کردن و برجسته‌سازی محصولات هستند. فقط ادمین می‌تواند تگ بسازد. هر تگ را به دسته‌بندی‌های مرتبط وصل کنید.
    *   *Example:* تگ "ضد آب" را به دسته "موبایل" و "ساعت هوشمند" متصل کنید.

### 1.3. Brand
*   **Logic:** Manufacturer. Linked to Categories (M2M). Hidden if category has no brands.
*   **Fields:** `id`, `name`, `slug` (English, **DB Unique Constraint**), `logo` (FK to MediaAsset, Nullable), `is_active`, `categories` (M2M).
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت برندها
    *   *Description:* برندها سازنده‌های محصولات هستند. هر برند را به دسته‌های مرتبط وصل کنید. اگر یک دسته هیچ برندی نداشته باشد، فیلد برند در فرم محصول و در سایت نمایش داده نمی‌شود.
    *   *Example:* برند "اپل" فقط به دسته "موبایل" و "لپ‌تاپ" متصل می‌شود.

### 1.4. Attribute & AttributeOption
*   **Logic:** Used for descriptions or generating Variants.
*   **Fields (Attribute):** `id`, `name` (Persian), `type` (Select, Text, Number), `is_filterable` (Boolean), `is_variant_generator` (Boolean), `categories` (M2M).
*   **Fields (AttributeOption):** `id`, `attribute_id` (FK), `value` (String - e.g., "Red"), `sort_order` (Integer).
*   **Constraint:** DB Unique Constraint on `(attribute_id, value)`.
*   **Validation:** If `type=Select`, the product/variant values must be validated against the allowed `AttributeOption` list.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت ویژگی‌ها
    *   *Description:* دو نوع کاربرد دارند: 1. ویژگی توصیفی (مثل جنس). 2. ویژگی تنوع‌ساز (مثل سایز). برای ویژگی‌های "Select"، گزینه‌های مجاز را از قبل تعریف کنید.

### 1.5. Unit (Measurement Unit)
*   **Logic:** Defines the base unit of a product.
*   **Fields:** `id`, `name` (Persian), `symbol`, `is_active`.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت واحدهای اندازه‌گیری
    *   *Description:* واحدهایی که محصولات با آن‌ها فروخته می‌شوند (کیلوگرم، عدد، بسته).

---

## 2. Product & Variant Architecture

### 2.1. Product (The Parent)
*   **Fields:**
    *   `id`, `name`, `slug` (English, **DB Unique Constraint**)
    *   `category_id` (FK), `brand_id` (FK, Nullable), `unit_id` (FK to Unit)
    *   `description_short` (Text), `description_long` (HTML, Sanitized)
    *   `is_published` (Boolean - Visibility on Storefront)
    *   `deleted_at` (DateTime, Nullable - Soft Delete)
    *   `tags` (M2M)
*   **Validation Rule:** If the category is changed, the system must re-validate that the assigned Brand, Tags, and Attribute Values still belong to the new Category.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* اطلاعات پایه محصول
    *   *Description:* با انتخاب "دسته‌بندی"، فیلدهای برند و تگ‌ها به‌روزرسانی می‌شوند. واحد اندازه‌گیری، واحدی است که مشتری با آن خرید می‌کند.

### 2.2. MediaAsset (Generic File Storage)
*   **Logic:** Stores all media files.
*   **Ownership & Status Rule (Strict DB Constraint):**
    *   **TEMPORARY (Draft):** `image_type = TEMPORARY`. All three owner FKs (`product_id`, `brand_id`, `category_id`) must be `NULL`.
    *   **ACTIVE (Linked):** `image_type` is anything other than `TEMPORARY`. **Exactly one** of the three owner FKs must be set (XOR condition combined with status).
*   **Server-Side Validation:** `image_type` must be compatible with the owner (e.g., `BrandLogo` can only have `brand_id` set, `CategoryIcon` only `category_id`, `Thumbnail/Main/Gallery/Description` only `product_id`).
*   **Fields:**
    *   `id`, `file` (ImageField), `alt_text` (String),
    *   `image_type` (Enum: Thumbnail, Main, Gallery, Description, BrandLogo, CategoryIcon, Temporary)
    *   `product_id` (FK, Nullable), `brand_id` (FK, Nullable), `category_id` (FK, Nullable)
*   **Upload Validation:** File size limits, real MIME type verification, image dimension checks.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* مدیریت تصاویر
    *   *Description:* تصاویر به صورت خودکار به WebP تبدیل و فشرده می‌شوند.

### 2.3. Product Variant (The Purchasable Item)
*   **Logic:** Every product MUST have at least one Variant. **All quantity fields are measured in the "Purchasable Unit".**
*   **Mathematical Validation Rules (Enforced in Backend):**
    *   `stock_quantity >= 0`
    *   `purchase_step > 0`
    *   `min_purchase > 0`
    *   `max_purchase >= min_purchase`
    *   Order quantity must be a multiple of `purchase_step`.
    *   Order quantity must be between `min_purchase` and `max_purchase`.
*   **Fields:**
    *   `id`, `product_id` (FK), `sku` (**DB Unique Constraint**)
    *   `combination_hash` (String): Normalized hash of variant attributes (e.g., `md5("1:Red|2:M")`).
    *   `stock_quantity` (Decimal)
    *   `pack_size` (Decimal, Nullable)
    *   `purchase_step` (Decimal, Default: 1)
    *   `min_purchase` (Decimal, Default: 1)
    *   `max_purchase` (Decimal, Default: 10)
*   **Constraint:** **DB Unique Constraint on `(product_id, combination_hash)`**. (Enforced on the ProductVariant table itself).
*   **Admin Panel Guide (UI Text):**
    *   *Title:* تعریف تنوع محصول
    *   *Description:* موجودی و محدودیت‌ها بر اساس "واحد خرید" است. اگر محصول بسته‌بندی ۳.۵ کیلویی است، موجودی ۲۰ یعنی ۲۰ بسته.

### 2.4. VariantAttribute (The Link)
*   **Logic:** Links Variants to their Attribute values.
*   **Fields:** `id`, `variant_id` (FK), `attribute_id` (FK), `value` (String).
*   **Atomic Update Rule:** When updating the attributes of a variant, the `VariantAttribute` records and the `combination_hash` on the `ProductVariant` must be updated **atomically within a single transaction** to prevent inconsistency.
*   **Constraints:** Unique together (`variant_id`, `attribute_id`).

---

## 3. Pricing & Discount Model

*   **Fields (Inside Variant):**
    *   `base_price` (Decimal), `wholesale_price` (Decimal, Nullable)
    *   `discount_percentage` (Decimal, Nullable), `is_discount_active` (Boolean).
*   **Permissions:** `products.edit_price` is a separate permission from `products.edit`.
*   **Admin Panel Guide (UI Text):**
    *   *Title:* قیمت‌گذاری
    *   *Description:* قیمت پایه و عمده را وارد کنید. قیمت نهایی به صورت خودکار محاسبه می‌شود.

---

## 4. Media, Storage & Image Architecture

*   **Paths:** Products (`/media/products/...`), Brands (`/media/brands/`), Categories (`/media/categories/`).
*   **Security:** Rich Text Editor input is sanitized via an allowlist (e.g., `bleach`) to prevent XSS.

---

## 5. Quantity, Unit & Step Logic

*   **Purchasable Unit:** The `unit` defined at the Product level is the **only** unit used for purchasing, stock, and limits.
*   **Loose Product:** Unit = "Kg". `pack_size = null`. Stock = `50` (Kg). Step = `0.5`. Min=1, Max=10.
*   **Packaged Product:** Unit = "Package". `pack_size = 3.5`. Stock = `20` (Packs). Step = `1`. Min=1, Max=10.
*   **Server-Side Validation:** Stock and max purchase validations must be enforced using database transactions (`SELECT FOR UPDATE`) to prevent overselling.

---

## 6. Admin Panel: Dynamic Product Creation Flow

1.  **Select Category:** Admin chooses a category.
2.  **Dynamic Fields:** Brand, Tags, and Attributes load based on the selected Category.
3.  **Unit Selection:** Admin selects the base Unit.
4.  **Rich Text Editor:** Admin writes the long description. Uploaded images are marked `TEMPORARY`.
5.  **Variant Definition:**
    *   Admin selects variant-generating attributes. The system auto-generates combinations.
    *   A normalized `combination_hash` is generated for each combination.
    *   Admin fills in SKU, prices, stock, and purchase limits.
6.  **Save:** System creates Product, Variants, and links the `TEMPORARY` MediaAssets to this Product (set to `DESCRIPTION`).

---

## 7. API Contracts & Permissions

### 7.1. Permissions (RBAC)
*   `categories.manage`, `tags.manage`, `brands.manage`, `attributes.manage`, `units.manage`, `media.manage`
*   `products.create`, `products.edit`, `products.publish`, `products.delete`
*   `products.edit_price`, `products.edit_stock` (Independent)

### 7.2. API Endpoints (Explicit CRUD)

**Media & Units:**
*   `POST /api/media/upload/` - Returns asset ID. Sets `TEMPORARY` if no owner.
*   `GET/POST/PUT/DELETE /api/units/` and `/api/units/{id}/`

**Catalog Metadata:**
*   `GET/POST/PUT/DELETE /api/categories/` and `/api/categories/{id}/`
*   `GET/POST/PUT/DELETE /api/tags/` and `/api/tags/{id}/`
*   `GET/POST/PUT/DELETE /api/brands/` and `/api/brands/{id}/`
*   `GET/POST/PUT/DELETE /api/attributes/` and `/api/attributes/{id}/`
*   `GET/POST/PUT/DELETE /api/attributes/{id}/options/` and `/api/attributes/{id}/options/{option_id}/`

**Products & Variants:**
*   `GET /api/products/` - List products with filters.
*   `GET /api/products/{slug}/` - Detail + Media + Variants.
*   `POST /api/products/` - Create product (with nested variants).
*   `PUT /api/products/{id}/` - Update product (re-validates category constraints).
*   `PATCH /api/products/{id}/toggle-publish/` - Toggles `is_published` ONLY.
*   `DELETE /api/products/{id}/` - Soft delete (sets `deleted_at`).
*   `PATCH /api/products/{id}/restore/` - Restores soft-deleted product.
*   `POST /api/products/{id}/variants/` - Add a new variant.
*   `PUT /api/products/{id}/variants/{variant_id}/` - Update a specific variant (Atomic hash update).
*   `PATCH /api/variants/{id}/stock/` - Update stock.

---

## 8. Frontend Flow & State Rules

*   **Permissions Rendering:** Hide/disable UI based on JWT permissions.
*   **Customer Tier:** Wholesale gets `wholesale_price` (fallback to `base_price`).
*   **Discount Display:** Strikethrough price, "X% Off" badge, Final Price.
*   **Quantity Input:**
    *   "+" increases by `purchase_step`.
    *   If `pack_size` exists, UI shows "X بسته (Y کیلوگرم)".
    *   Capped at `max_purchase`.
*   **Rich Text Rendering:** Sanitized HTML rendering.

---

## 9. Implementation Deliverables

Based on this specification, the engineering team must:
1.  Create the database models and relationships exactly as defined (including generic MediaAsset, Unit, AttributeOption, and VariantAttribute).
2.  Implement **all explicit CRUD API endpoints** listed in section 7.
3.  Enforce **all database-level constraints**:
    *   `slug` uniqueness (Category, Tag, Brand, Product).
    *   `sku` uniqueness.
    *   `UniqueConstraint(product, combination_hash)` on the **ProductVariant** table.
    *   `(attribute_id, value)` uniqueness for AttributeOption.
    *   **Strict MediaAsset constraint**: XOR ownership for ACTIVE files, and all NULL for TEMPORARY files.
4.  Set up and configure the Django Admin.
5.  Create a fully custom, Persian (RTL) Admin Panel using Next.js:
    *   Include "Admin Panel Guide" text blocks.
    *   Dynamic UI based on selected category.
    *   Conditional rendering based on RBAC.
    *   Rich Text Editor with Image Upload and XSS sanitization.
    *   Auto-generate variant combinations with the ability to disable specific combos.
6.  Implement **server-side mathematical validations** (`stock >= 0`, `step > 0`, etc.) and use `SELECT FOR UPDATE` for stock updates.
7.  Ensure **atomic transactions** for updating Variant attributes and their `combination_hash`.
8.  Validate media uploads (size, real MIME type, dimensions, and compatibility of `image_type` with the owner).
9.  Enforce **2-level Category depth** in the backend.

**Expected Output:** Complete backend code (models, APIs, permissions, sanitization, validations) and a working Next.js frontend admin panel with integrated help texts.