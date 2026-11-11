from decimal import Decimal

from rest_framework import serializers

from catalog.models import MediaAsset, Product, ProductVariant
from catalog.serializers.attribute_value import AttributeValueSerializer

# Image shown on product cards and cart lines, in order of preference.
CARD_IMAGE_TYPES = (MediaAsset.ImageType.THUMBNAIL, MediaAsset.ImageType.MAIN, MediaAsset.ImageType.GALLERY)
BADGE_NEW = "جدید"
BADGE_BESTSELLER = "پرفروش"


def card_image_url(product: Product) -> str | None:
    """Card image from the prefetched ``media``."""
    for image_type in CARD_IMAGE_TYPES:
        for asset in product.media.all():
            if asset.image_type == image_type:
                return asset.file.url
    return None


class StorefrontVariantSerializer(serializers.ModelSerializer):
    """Public variant: prices for the caller's tier (``context["tier"]``) and availability, never stock counts or the
    wholesale price of another tier.
    """

    attributes = AttributeValueSerializer(many=True, read_only=True)
    original_price = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "sku", "attributes", "pack_size", "purchase_step", "min_purchase", "max_purchase",
            "original_price", "price", "discount_percentage", "is_available",
        ]
        read_only_fields = fields

    # Decimals are rendered as strings like every other money field of the API.
    def get_original_price(self, variant: ProductVariant) -> str:
        return str(variant.price_for(self.context["tier"])[0])

    def get_price(self, variant: ProductVariant) -> str:
        original, discount = variant.price_for(self.context["tier"])
        return str(original - discount)

    def get_discount_percentage(self, variant: ProductVariant) -> str | None:
        active = variant.is_discount_active and variant.discount_percentage
        return str(variant.discount_percentage) if active else None

    def get_is_available(self, variant: ProductVariant) -> bool:
        return variant.available_quantity >= variant.min_purchase


class StorefrontProductListSerializer(serializers.ModelSerializer):
    """Product card. Needs a ``Product.storefront()`` row with ``variants`` and ``media`` prefetched, and
    ``context`` with ``tier``, ``new_since`` and ``bestsellers`` (``Product.badge_rules``).
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    image_url = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()
    rating_count = serializers.IntegerField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    badges = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "category_name", "category_slug", "brand", "brand_name", "unit_name",
            "description_short", "image_url", "price", "rating_average", "rating_count", "in_stock", "badges",
        ]
        read_only_fields = fields

    def get_image_url(self, product: Product) -> str | None:
        return card_image_url(product)

    def get_price(self, product: Product) -> dict | None:
        """The cheapest variant for the caller's tier: ``{original_price, price, discount_percentage}``."""
        variants = StorefrontVariantSerializer(product.variants.all(), many=True, context=self.context).data
        if not variants:
            return None
        cheapest = min(variants, key=lambda variant: Decimal(variant["price"]))
        return {key: cheapest[key] for key in ("original_price", "price", "discount_percentage")}

    def get_rating_average(self, product: Product) -> str | None:
        average = product.rating_average
        return f"{average:.1f}" if average is not None else None

    def get_badges(self, product: Product) -> list[str]:
        badges = []
        new_since = self.context["new_since"]
        if new_since is not None and product.created_at >= new_since:
            badges.append(BADGE_NEW)
        if product.pk in self.context["bestsellers"]:
            badges.append(BADGE_BESTSELLER)
        return badges


class StorefrontProductSerializer(StorefrontProductListSerializer):
    """Product page: card fields plus descriptions, the flat specification table, every variant and the media."""

    brand_slug = serializers.CharField(source="brand.slug", read_only=True, default=None)
    unit_symbol = serializers.CharField(source="unit.symbol", read_only=True)
    specifications = AttributeValueSerializer(source="attribute_values", many=True, read_only=True)
    variants = StorefrontVariantSerializer(many=True, read_only=True)
    media = serializers.SerializerMethodField()

    class Meta(StorefrontProductListSerializer.Meta):
        fields = [
            *StorefrontProductListSerializer.Meta.fields, "brand_slug", "unit_symbol", "description_long",
            "specifications", "variants", "media",
        ]
        read_only_fields = fields

    def get_media(self, product: Product) -> list[dict]:
        return [
            {"id": asset.pk, "url": asset.file.url, "alt_text": asset.alt_text, "image_type": asset.image_type}
            for asset in sorted(product.media.all(), key=lambda asset: (asset.sort_order, asset.pk))
            if asset.image_type != MediaAsset.ImageType.DESCRIPTION
        ]
