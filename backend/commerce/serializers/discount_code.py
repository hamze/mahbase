from rest_framework import serializers

from accounts.models import normalize_mobile
from catalog.serializers.base import ModelCleanSerializer
from commerce.models import DiscountCode


class DiscountCodeSerializer(ModelCleanSerializer):
    class Meta:
        model = DiscountCode
        fields = [
            "id", "code", "product_discount_type", "amount", "percentage", "max_discount_amount", "free_shipping",
            "category", "min_eligible_subtotal", "starts_at", "ends_at", "usage_limit_total", "used_count",
            "per_user_limit", "specific_mobile", "is_active", "release_on_refund", "created_at",
        ]
        read_only_fields = ["used_count", "created_at"]

    def validate_specific_mobile(self, value: str) -> str:
        return normalize_mobile(value) if value else value


class DiscountCodeGenerateSerializer(DiscountCodeSerializer):
    """Bulk generation of ``count`` single-use codes sharing the given settings (``code`` is used as the prefix)."""

    count = serializers.IntegerField(min_value=1, max_value=1000)

    class Meta(DiscountCodeSerializer.Meta):
        fields = [*DiscountCodeSerializer.Meta.fields, "count"]
        extra_kwargs = {"code": {"validators": [], "required": False, "allow_blank": True}}


class DiscountValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    shipping_method = serializers.IntegerField(required=False)
