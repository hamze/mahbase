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

export type MediaImageType = "thumbnail" | "main" | "gallery" | "description" | "brand_logo" | "category_icon" | "temporary";

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

export type City = { id: number; name: string; province: number };

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
