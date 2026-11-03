from rest_framework import serializers

from catalog.models import ProductVariant
from catalog.models.product_variant import QUANTITY


class CartItemWriteSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.select_related("product"))
    quantity = serializers.DecimalField(**QUANTITY)


class CartQuantitySerializer(serializers.Serializer):
    quantity = serializers.DecimalField(**QUANTITY)


class CartLineSerializer(serializers.Serializer):
    """A priced cart line (an unsaved ``OrderItem``) with its current purchase-rule warnings."""

    variant = serializers.IntegerField(source="variant_id")
    product = serializers.IntegerField(source="product_id")
    product_name = serializers.CharField(source="product_name_snapshot")
    variant_label = serializers.CharField(source="variant_label_snapshot")
    sku = serializers.CharField(source="sku_snapshot")
    unit_name = serializers.CharField(source="unit_name_snapshot")
    quantity = serializers.DecimalField(**QUANTITY)
    original_unit_price = serializers.DecimalField(source="original_unit_price_snapshot", max_digits=18, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    warnings = serializers.ListField(child=serializers.CharField())
