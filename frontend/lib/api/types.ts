export type Category = {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  is_active: boolean;
  sort_order: number;
  seo_title: string;
  seo_description: string;
  icon_url: string | null;
};

export type Tag = { id: number; name: string; slug: string; is_featured: boolean; is_active: boolean; categories: number[] };

export type Brand = {
  id: number;
  name: string;
  slug: string;
  logo: number | null;
  logo_url: string | null;
  is_active: boolean;
  categories: number[];
};

export type Unit = { id: number; name: string; symbol: string; is_active: boolean };

export type AttributeType = "select" | "text" | "number";

export type AttributeOption = { id: number; attribute: number; value: string; sort_order: number; is_active: boolean };

export type Attribute = {
  id: number;
  name: string;
  type: AttributeType;
  is_filterable: boolean;
  is_variant_generator: boolean;
  is_active: boolean;
  categories: number[];
  options: AttributeOption[];
};

export type MediaImageType =
  | "thumbnail"
  | "main"
  | "gallery"
  | "description"
  | "brand_logo"
  | "category_icon"
  | "blog_cover"
  | "blog_content"
  | "banner_image"
  | "store_logo"
  | "trust_badge"
  | "temporary";

export type MediaAsset = {
  id: number;
  url: string;
  alt_text: string;
  image_type: MediaImageType;
  sort_order: number;
  width: number;
  height: number;
};

export type AttributeValue = { attribute: number; attribute_name?: string; value: string };

export type Variant = {
  id?: number;
  sku: string;
  combination_hash?: string;
  attributes: AttributeValue[];
  stock_quantity?: string;
  /** Held by unpaid orders (read only). */
  reserved_quantity?: string;
  pack_size: string | null;
  purchase_step: string;
  min_purchase: string;
  max_purchase: string;
  base_price?: string;
  wholesale_price?: string | null;
  discount_percentage?: string | null;
  is_discount_active?: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  category: number;
  category_name: string;
  brand: number | null;
  brand_name: string | null;
  unit: number;
  unit_name: string;
  unit_symbol: string;
  description_short: string;
  description_long: string;
  is_published: boolean;
  deleted_at: string | null;
  tags: number[];
  attribute_values: AttributeValue[];
  variants: Variant[];
  media: MediaAsset[];
  created_at: string;
  updated_at: string;
};

export type MediaClaim = { id: number; image_type: Exclude<MediaImageType, "brand_logo" | "category_icon" | "temporary"> };

export type ProductInput = {
  name: string;
  slug: string;
  category: number;
  brand: number | null;
  unit: number;
  description_short: string;
  description_long: string;
  tags: number[];
  attribute_values: AttributeValue[];
  variants?: Variant[];
  media: MediaClaim[];
  /** Ids of the product's existing media to detach (update only). */
  remove_media?: number[];
};

export type DeleteResult = { id: number; deactivated: true } | null;

export type CustomerTier = "RETAIL" | "WHOLESALE";

export type AdminUser = {
  id: number;
  mobile: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  customer_tier: CustomerTier;
  account_status: "ACTIVE" | "BLOCKED";
  created_source: "SELF_SIGNUP" | "ADMIN_CREATED";
  date_joined: string;
  last_login: string | null;
};

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "IN_PREPARATION"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type ReservationStatus = "RESERVED" | "CONVERTED" | "RELEASED";
export type PreparationStatus = "PENDING" | "PREPARING" | "PREPARED";

export type OrderListItem = {
  id: number;
  order_number: string;
  customer: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  stock_reservation_status: ReservationStatus;
  stock_invalidated: boolean;
  payable_total: string;
  placed_at: string;
};

export type OrderItem = {
  id: number;
  product: number | null;
  variant: number | null;
  product_name_snapshot: string;
  variant_label_snapshot: string;
  sku_snapshot: string;
  unit_name_snapshot: string;
  quantity: string;
  original_unit_price_snapshot: string;
  unit_price: string;
  line_total: string;
  preparation_status: PreparationStatus;
  returned_quantity: string;
};

export type RefundStatus = "REQUESTED" | "APPROVED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";

export type OrderRefund = {
  id: number;
  order: number;
  order_number: string;
  amount: string;
  reason: "ADMIN_CANCEL_BEFORE_SHIP" | "RETURN" | "PAYMENT_AFTER_RELEASE" | "STOCK_INVALIDATED" | "PAYMENT_AMOUNT_MISMATCH";
  status: RefundStatus;
  gateway_refund_id: string;
  created_at: string;
};

export type ReturnStatus = "REQUESTED" | "APPROVED" | "RECEIVED" | "COMPLETED" | "REJECTED" | "CANCELLED";

export type ReturnRequest = {
  id: number;
  order: number;
  order_number: string;
  reason: string;
  status: ReturnStatus;
  refund_amount: string;
  refund_status: RefundStatus | null;
  items: { id: number; order_item: number; sku: string; product_name: string; quantity: string; resaleable: boolean | null }[];
  created_at: string;
};

export type PaymentTransaction = {
  id: number;
  gateway: string;
  gateway_transaction_id: string | null;
  amount: string;
  status: string;
  created_at: string;
};

export type Order = Omit<OrderListItem, "id"> & {
  id: number;
  customer_tier_snapshot: CustomerTier;
  subtotal_products: string;
  product_discount_total: string;
  discount_code_snapshot: string;
  discount_amount: string;
  shipping_method_name_snapshot: string;
  shipping_cost: string;
  shipping_discount_amount: string;
  other_costs: string;
  paid_total: string;
  refunded_total: string;
  reservation_expires_at: string;
  cancellation_reason: string;
  manual_next_statuses: OrderStatus[];
  items: OrderItem[];
  address: {
    receiver_name: string;
    receiver_mobile: string;
    province_name: string;
    city_name: string;
    address_line: string;
    postal_code: string;
    plaque: string;
    unit: string;
  } | null;
  payments: PaymentTransaction[];
  refunds: OrderRefund[];
  return_requests: ReturnRequest[];
};

export type ProductQuestion = {
  id: number;
  product: number;
  product_name: string;
  user_mobile: string | null;
  question_text: string;
  answer_text: string | null;
  status: "PENDING" | "ANSWERED" | "REJECTED";
  created_by_type: "CUSTOMER" | "ADMIN";
  is_public: boolean;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  actor_username: string | null;
  action: string;
  target_type: string;
  target_id: string;
  data: Record<string, unknown>;
  created_at: string;
};

export type City = { id: number; name: string; province: number; province_name: string };

export type StockBelowReserved = {
  warning: "stock_below_reserved";
  requested: string;
  reserved_quantity: string;
  shortfall: string;
  affected_orders: { order_number: string; quantity: string }[];
  action_required: "confirm";
};

export type Province = { id: number; name: string };

export type Address = {
  id: number;
  title: string;
  receiver_name: string;
  receiver_mobile: string;
  province: number;
  province_name: string;
  city: number;
  city_name: string;
  address_line: string;
  postal_code: string;
  plaque: string;
  unit: string;
  is_default: boolean;
};

export type ShippingOption = { id: number; name: string; description: string; price: string };

/** A sellable variant priced for the selected customer's tier (admin order form). */
export type OrderVariantOption = {
  id: number;
  sku: string;
  product_name: string;
  variant_label: string;
  unit_name: string;
  original_unit_price: string;
  unit_price: string;
  available_quantity: string;
  min_purchase: string;
  max_purchase: string;
  purchase_step: string;
};

export type NewAddress = Omit<Address, "id" | "province_name" | "city_name" | "is_default">;

export type AdminOrderCreate = {
  customer: number | null;
  new_customer: Pick<AdminUser, "mobile" | "first_name" | "last_name" | "customer_tier"> | null;
  address: number | null;
  new_address: NewAddress | null;
  shipping_method: number;
  discount_code: string;
  items: { variant: number; quantity: string }[];
};

export type OrderCreated = { order_number: string; payment_redirect_url: string; order: Order };

export type AccessPermission = {
  id: number;
  code: string;
  label_fa: string;
  module: string;
  description_fa: string | null;
  is_active: boolean;
};

export type AccessGroup = {
  id: number;
  name: string;
  slug: string;
  description_fa: string | null;
  permissions: string[];
  is_system: boolean;
  user_count: number;
  permission_count: number;
};

export type AccessUser = {
  id: number;
  username: string;
  full_name: string;
  mobile: string | null;
  group: number | null;
  group_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
};

export type BlogCategory = {
  id: number;
  name: string;
  slug: string;
  description_short: string | null;
  parent: number | null;
  is_active: boolean;
  is_internal: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
};

export type BlogPostStatus = "DRAFT" | "PUBLISHED";

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  category: number;
  category_name: string;
  excerpt: string | null;
  content: string;
  cover_image: number | null;
  cover_image_url: string | null;
  /** Read: editor images owned by the post; write: ids of images still in the content. */
  content_images: { id: number; url: string }[];
  author_name: string;
  status: BlogPostStatus;
  published_at: string | null;
  is_internal_page: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  tags: number[];
};

export type BlogPostWrite = Omit<
  BlogPost,
  "id" | "category_name" | "cover_image_url" | "content_images" | "author_name" | "status" | "published_at" | "is_internal_page"
> & { content_images: number[] };

export type NotificationStatus = "NEW" | "READ" | "ARCHIVED";

export type Notification = {
  id: number;
  user: number | null;
  user_mobile: string | null;
  type: "SYSTEM" | "ORDER" | "REVIEW" | "CONTACT" | "ACCOUNT";
  title: string;
  body: string;
  status: NotificationStatus;
  channel: "IN_APP" | "SMS" | "EMAIL";
  related_object_type: string | null;
  related_object_id: number | null;
  created_at: string;
  read_at: string | null;
};

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProductReview = {
  id: number;
  product: number;
  product_name: string;
  user_mobile: string;
  order_number: string | null;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  moderated_at: string | null;
  reject_reason: string | null;
  created_at: string;
};

export type ContactMessageStatus = "NEW" | "READ" | "REPLIED";

export type ContactMessage = {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  note: string;
  created_at: string;
};

export type SocialLinks = Partial<Record<"instagram" | "telegram" | "whatsapp" | "twitter" | "linkedin" | "youtube" | "aparat", string | null>>;

export type TrustBadge = { image_id: number; link_url: string; image_url?: string | null };

export type StoreSettings = {
  store_name: string;
  logo: number | null;
  logo_url: string | null;
  primary_color: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  social_links: SocialLinks;
  trust_badges: TrustBadge[];
  default_profit_percentage: string;
  reviews_enabled: boolean;
  cod_enabled: boolean;
  out_of_stock_display: "SHOW_WITH_BADGE" | "MOVE_TO_END";
  sms_notifications_enabled: boolean;
  footer_text: string;
};
