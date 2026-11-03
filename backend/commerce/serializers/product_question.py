from rest_framework import serializers

from commerce.models import ProductQuestion


class PublicProductQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductQuestion
        fields = ["id", "question_text", "answer_text", "answered_at", "created_at"]
        read_only_fields = ["answer_text", "answered_at", "created_at"]


class ProductQuestionSerializer(serializers.ModelSerializer):
    """Admin view; admins may also create questions (``created_by_type=ADMIN``)."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    user_mobile = serializers.CharField(source="user.username", read_only=True, default=None)

    class Meta:
        model = ProductQuestion
        fields = [
            "id", "product", "product_name", "user", "user_mobile", "question_text", "answer_text", "status",
            "created_by_type", "answered_by", "answered_at", "is_public", "created_at",
        ]
        read_only_fields = [
            "user", "answer_text", "status", "created_by_type", "answered_by", "answered_at", "is_public", "created_at"
        ]


class ProductQuestionAnswerSerializer(serializers.Serializer):
    answer_text = serializers.CharField()
    is_public = serializers.BooleanField(default=True)
