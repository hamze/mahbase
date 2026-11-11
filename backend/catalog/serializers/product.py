from django.db import transaction
from rest_framework import serializers

from catalog.models import Attribute, Category, MediaAsset, Product, ProductVariant
from catalog.serializers.attribute_value import AttributeValueSerializer, as_pairs
from catalog.serializers.media_asset import MediaAssetSerializer
from catalog.serializers.product_variant import ProductVariantSerializer


class MediaClaimSerializer(serializers.Serializer):
    """A temporary upload to attach to the product; list order becomes the media sort order."""

    id = serializers.IntegerField()
    image_type = serializers.ChoiceField(choices=MediaAsset.PRODUCT_TYPES)


class ProductSerializer(serializers.ModelSerializer):
    """Read representation: product with descriptive values, variants and media."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    unit_symbol = serializers.CharField(source="unit.symbol", read_only=True)
    attribute_values = AttributeValueSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    media = MediaAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "category_name", "brand", "brand_name", "unit", "unit_name",
            "unit_symbol", "description_short", "description_long", "is_published", "deleted_at", "tags",
            "attribute_values", "variants", "media", "created_at", "updated_at",
        ]
        read_only_fields = fields


class ProductWriteSerializer(serializers.ModelSerializer):
    """Create (with nested variants) and update of a product.

    Publication is changed only through toggle-publish; variants after creation through the variant endpoints.
    """

    attribute_values = AttributeValueSerializer(many=True, required=False)
    variants = ProductVariantSerializer(many=True, required=False)
    media = MediaClaimSerializer(many=True, required=False)
    # Ids of this product's media to detach on update; they become temporary and are removed by cleanup.
    remove_media = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "brand", "unit", "description_short", "description_long", "tags",
            "attribute_values", "variants", "media", "remove_media",
        ]

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        product = self.instance
        category = attrs.get("category", product.category if product else None)
        brand = attrs.get("brand", product.brand if product else None)
        tags = attrs.get("tags", list(product.tags.all()) if product else [])
        self._require_active(attrs, product)
        Product.validate_catalog_assignments(category, brand, tags)

        if "attribute_values" in attrs:
            attrs["attribute_values"] = Attribute.validate_values(
                category.pk, as_pairs(attrs["attribute_values"]), variant_generator=False
            )
        if product is not None and category.pk != product.category_id:
            product.validate_category_change(category, keep_attribute_values="attribute_values" not in attrs)

        if product is None:
            attrs["variants"] = self._validate_new_variants(category, attrs.get("variants", []))
        elif "variants" in attrs:
            raise serializers.ValidationError({"variants": "برای تغییر تنوع‌ها از بخش تنوع‌ها استفاده کنید."})
        return attrs

    def _require_active(self, attrs: dict, product: Product | None) -> None:
        """Deactivated catalog entries stay on products that have them but cannot be newly assigned."""
        errors = {}
        for name in ("category", "brand", "unit"):
            value = attrs.get(name)
            if value is not None and not value.is_active and (product is None or getattr(product, f"{name}_id") != value.pk):
                errors[name] = f"«{value}» غیرفعال است."
        current_tags = set(product.tags.values_list("pk", flat=True)) if product else set()
        inactive_tags = [str(tag) for tag in attrs.get("tags", []) if not tag.is_active and tag.pk not in current_tags]
        if inactive_tags:
            errors["tags"] = f"برچسب‌های {inactive_tags} غیرفعال هستند."
        if errors:
            raise serializers.ValidationError(errors)

    def _validate_new_variants(self, category: Category, variants: list[dict]) -> list[dict]:
        if not variants:
            raise serializers.ValidationError({"variants": "محصول باید حداقل یک تنوع داشته باشد."})
        hashes = set()
        for variant in variants:
            variant["attributes"] = Attribute.validate_values(
                category.pk, as_pairs(variant.get("attributes", [])), variant_generator=True
            )
            combination_hash = ProductVariant.compute_combination_hash(variant["attributes"])
            if combination_hash in hashes:
                raise serializers.ValidationError({"variants": "دو تنوع ترکیب ویژگی یکسانی دارند."})
            hashes.add(combination_hash)
        return variants

    def create(self, validated_data: dict) -> Product:
        tags = validated_data.pop("tags", [])
        attribute_values = validated_data.pop("attribute_values", [])
        variants = validated_data.pop("variants")
        media = validated_data.pop("media", [])
        validated_data.pop("remove_media", None)
        with transaction.atomic():
            product = Product.objects.create(**validated_data)
            product.tags.set(tags)
            product.set_attribute_values(attribute_values)
            for variant in variants:
                ProductVariantSerializer.create_for(product, variant)
            MediaAsset.claim([(item["id"], item["image_type"]) for item in media], product=product)
        return product

    def update(self, product: Product, validated_data: dict) -> Product:
        tags = validated_data.pop("tags", None)
        attribute_values = validated_data.pop("attribute_values", None)
        media = validated_data.pop("media", [])
        remove_media = validated_data.pop("remove_media", [])
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product.pk)
            for name, value in validated_data.items():
                setattr(product, name, value)
            product.save()
            if tags is not None:
                product.tags.set(tags)
            if attribute_values is not None:
                product.set_attribute_values(attribute_values)
            if remove_media:
                MediaAsset.release(product=product, pk__in=remove_media)
            MediaAsset.claim([(item["id"], item["image_type"]) for item in media], product=product)
        return product

    def to_representation(self, product: Product) -> dict:
        return ProductSerializer(product, context=self.context).data
