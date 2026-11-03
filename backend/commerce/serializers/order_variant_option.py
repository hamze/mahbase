from rest_framework import serializers

from commerce.models import OrderItem


class OrderVariantOptionSerializer(serializers.BaseSerializer):
    """A sellable variant as the admin order form shows it, priced for ``context["tier"]`` exactly like an order line."""

    def to_representation(self, variant: object) -> dict:
        line = OrderItem.from_variant(variant, variant.min_purchase, self.context["tier"])
        return {
            "id": variant.pk,
            "sku": variant.sku,
            "product_name": line.product_name_snapshot,
            "variant_label": line.variant_label_snapshot,
            "unit_name": line.unit_name_snapshot,
            "original_unit_price": line.original_unit_price_snapshot,
            "unit_price": line.unit_price,
            "available_quantity": variant.available_quantity,
            "min_purchase": variant.min_purchase,
            "max_purchase": variant.max_purchase,
            "purchase_step": variant.purchase_step,
        }
