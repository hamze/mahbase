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
