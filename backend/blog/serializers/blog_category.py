from rest_framework import serializers

from blog.models import BlogCategory
from catalog.serializers.base import ModelCleanSerializer


class BlogCategorySerializer(ModelCleanSerializer):
    """Admin representation; ``is_internal`` is fixed (only the seeded internal category has it)."""

    class Meta:
        model = BlogCategory
        fields = [
            "id", "name", "slug", "description_short", "parent", "is_active", "is_internal", "sort_order",
            "seo_title", "seo_description", "canonical_url",
        ]
        read_only_fields = ["is_internal"]


class PublicBlogCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogCategory
        fields = [
            "id", "name", "slug", "description_short", "parent", "sort_order", "seo_title", "seo_description",
            "canonical_url",
        ]
