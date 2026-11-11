from rest_framework import serializers

from commerce.models import FAQ, FAQCategory


class FAQCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQCategory
        fields = ["id", "title", "sort_order", "is_active"]


class FAQSerializer(serializers.ModelSerializer):
    """``answer`` is rich text, sanitized with the allowlist on save."""

    class Meta:
        model = FAQ
        fields = [
            "id", "category", "question", "answer", "is_active", "sort_order", "show_on_home", "home_sort_order",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
