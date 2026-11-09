from rest_framework import serializers

from commerce.models import ProductReview
from commerce.models.product_review import REVIEW_BODY_MAX_LENGTH


class PublicProductReviewSerializer(serializers.ModelSerializer):
    """Read: an approved review (first name only). Write: a customer's new review (verified on save)."""

    user_name = serializers.CharField(source="user.first_name", read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    body = serializers.CharField(max_length=REVIEW_BODY_MAX_LENGTH)

    class Meta:
        model = ProductReview
        fields = ["id", "user_name", "rating", "title", "body", "status", "created_at"]
        read_only_fields = ["status", "created_at"]


class ProductReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    user_mobile = serializers.CharField(source="user.username", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True, default=None)

    class Meta:
        model = ProductReview
        fields = [
            "id", "product", "product_name", "user", "user_mobile", "order", "order_number", "rating", "title", "body",
            "status", "moderated_by", "moderated_at", "reject_reason", "created_at", "updated_at",
        ]
        read_only_fields = fields


class ReviewRejectSerializer(serializers.Serializer):
    reject_reason = serializers.CharField()
