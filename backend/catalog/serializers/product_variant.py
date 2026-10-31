from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from catalog.models import Attribute, Category, Product, ProductVariant
from catalog.permissions import has_rbac_permission
from catalog.serializers.attribute_value import AttributeValueSerializer, as_pairs
from catalog.serializers.base import ModelCleanSerializer

PRICE_FIELDS = ("base_price", "wholesale_price", "discount_percentage", "is_discount_active")


class ProductVariantSerializer(ModelCleanSerializer):
    """Variant read/write.

    Price fields need ``products.edit_price`` and initial stock needs ``products.edit_stock``;
    stock changes after creation go through the locked stock endpoint only.
    When ``context["product"]`` is set, attributes are validated against that product's category;
    nested inside a product create, the product serializer validates them instead.
    """

    attributes = AttributeValueSerializer(many=True, required=False)

    class Meta:
        model = ProductVariant
        fields = [
            "id", "sku", "combination_hash", "attributes", "stock_quantity", "pack_size", "purchase_step",
            "min_purchase", "max_purchase", *PRICE_FIELDS,
        ]
        read_only_fields = ["combination_hash"]

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        user = self.context["request"].user
        if self._changes(attrs, PRICE_FIELDS) and not has_rbac_permission(user, "products.edit_price"):
            raise PermissionDenied("You do not have permission to edit prices.")
        if self._changes(attrs, ["stock_quantity"]):
            if self.instance is not None:
                raise serializers.ValidationError({"stock_quantity": "Use the stock endpoint to change stock."})
            if not has_rbac_permission(user, "products.edit_stock"):
                raise PermissionDenied("You do not have permission to edit stock.")
        product = self.context.get("product")
        if product is not None:
            attrs["attributes"] = Attribute.validate_values(
                product.category_id, as_pairs(attrs.get("attributes", [])), variant_generator=True
            )
        return attrs

    def _changes(self, attrs: dict, fields: list[str] | tuple[str, ...]) -> bool:
        if self.instance is None:
            return any(field in attrs for field in fields)
        return any(field in attrs and attrs[field] != getattr(self.instance, field) for field in fields)

    def create(self, validated_data: dict) -> ProductVariant:
        product: Product = self.context["product"]
        return self.create_for(product, validated_data)

    @staticmethod
    def create_for(product: Product, validated_data: dict) -> ProductVariant:
        """Create a variant whose ``attributes`` are already validated (attribute, value) pairs."""
        pairs = validated_data.pop("attributes")
        variant = ProductVariant(product=product, **validated_data)
        variant.set_attributes(pairs)
        return variant

    def update(self, variant: ProductVariant, validated_data: dict) -> ProductVariant:
        pairs = validated_data.pop("attributes")
        with transaction.atomic():
            variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
            for name, value in validated_data.items():
                setattr(variant, name, value)
            variant.set_attributes(pairs)
        return variant

    def to_representation(self, variant: ProductVariant) -> dict:
        data = super().to_representation(variant)
        data["attributes"] = AttributeValueSerializer(variant.attributes.all(), many=True).data
        return data


class PriceUpdateSerializer(ModelCleanSerializer):
    """Partial price update of one variant (``products.edit_price``) without touching its other fields."""

    class Meta:
        model = ProductVariant
        fields = list(PRICE_FIELDS)

    def update(self, variant: ProductVariant, validated_data: dict) -> ProductVariant:
        for name, value in validated_data.items():
            setattr(variant, name, value)
        # Only the price columns are written so a concurrent stock change is not overwritten.
        variant.save(update_fields=list(validated_data))
        return variant


class PriceAdjustmentSerializer(serializers.Serializer):
    """Site-wide percentage change of base and wholesale prices, optionally limited to one category."""

    percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("-99.99"), max_value=Decimal("999.99")
    )
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)


class StockUpdateSerializer(serializers.Serializer):
    """Exactly one of ``stock_quantity`` (absolute) or ``delta`` (relative change)."""

    stock_quantity = serializers.DecimalField(max_digits=12, decimal_places=3, required=False)
    delta = serializers.DecimalField(max_digits=12, decimal_places=3, required=False)

    def validate(self, attrs: dict) -> dict:
        if len(attrs) != 1:
            raise serializers.ValidationError("Provide exactly one of 'stock_quantity' or 'delta'.")
        return attrs
