from rest_framework import serializers

from catalog.models.product_variant import QUANTITY
from commerce.models import (
    Order,
    OrderAddressSnapshot,
    OrderItem,
    OrderRefund,
    PaymentTransaction,
    ReturnRequest,
    ReturnRequestItem,
)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "variant", "product_name_snapshot", "variant_label_snapshot", "sku_snapshot",
            "unit_name_snapshot", "quantity", "original_unit_price_snapshot", "unit_price",
            "product_discount_per_unit", "line_product_discount_total", "line_total", "preparation_status",
            "returned_quantity", "restocked_at",
        ]
        read_only_fields = fields


class OrderAddressSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderAddressSnapshot
        exclude = ["id", "order"]


class OrderRefundSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = OrderRefund
        fields = [
            "id", "order", "order_number", "amount", "reason", "status", "requested_by", "approved_by",
            "gateway_refund_id", "created_at", "approved_at", "completed_at",
        ]
        read_only_fields = fields


class ReturnRequestItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="order_item.sku_snapshot", read_only=True)
    product_name = serializers.CharField(source="order_item.product_name_snapshot", read_only=True)

    class Meta:
        model = ReturnRequestItem
        fields = ["id", "order_item", "sku", "product_name", "quantity", "resaleable"]
        read_only_fields = fields


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    items = ReturnRequestItemSerializer(many=True, read_only=True)
    refund_status = serializers.CharField(source="order_refund.status", read_only=True, default=None)

    class Meta:
        model = ReturnRequest
        fields = [
            "id", "order", "order_number", "reason", "status", "refund_amount", "order_refund", "refund_status",
            "items", "created_at", "updated_at",
        ]
        read_only_fields = fields


class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        exclude = ["raw_response", "order"]


class OrderSerializer(serializers.ModelSerializer):
    """Order with lines, address snapshot, payments, refunds and returns (read only)."""

    items = OrderItemSerializer(many=True, read_only=True)
    address = OrderAddressSnapshotSerializer(source="address_snapshot", read_only=True)
    payments = PaymentTransactionSerializer(many=True, read_only=True)
    refunds = OrderRefundSerializer(many=True, read_only=True)
    return_requests = ReturnRequestSerializer(many=True, read_only=True)
    customer = serializers.CharField(source="user.username", read_only=True)
    manual_next_statuses = serializers.SerializerMethodField()

    class Meta:
        model = Order
        exclude = ["idempotency_key", "user", "discount_code"]
        read_only_fields = [field.name for field in Order._meta.concrete_fields]

    def get_manual_next_statuses(self, order: Order) -> list[str]:
        """Statuses the admin status endpoint accepts next, so the UI does not repeat the state machine."""
        return sorted(Order.MANUAL_TRANSITIONS.get(order.order_status, set()))


class OrderListSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "customer", "order_status", "payment_status", "stock_reservation_status",
            "stock_invalidated", "payable_total", "placed_at",
        ]
        read_only_fields = fields


class OrderCreateSerializer(serializers.Serializer):
    address = serializers.IntegerField()
    shipping_method = serializers.IntegerField()
    discount_code = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")


class OrderQuoteRequestSerializer(serializers.Serializer):
    shipping_method = serializers.IntegerField(required=False, allow_null=True, default=None)
    discount_code = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")


class OrderQuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "subtotal_products", "product_discount_total", "discount_code_snapshot", "discount_amount",
            "shipping_cost", "shipping_discount_amount", "packaging_fee", "tax_percentage", "tax_amount",
            "payable_total",
        ]
        read_only_fields = fields


class ReturnLineSerializer(serializers.Serializer):
    order_item = serializers.IntegerField()
    quantity = serializers.DecimalField(**QUANTITY)


class ReturnRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField()
    items = ReturnLineSerializer(many=True)
