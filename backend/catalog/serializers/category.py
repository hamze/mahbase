from rest_framework import serializers

from catalog.models import Category, MediaAsset
from catalog.serializers.base import ModelCleanSerializer


class CategorySerializer(ModelCleanSerializer):
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "parent", "is_active", "sort_order", "seo_title", "seo_description", "icon_url",
        ]

    def get_icon_url(self, category: Category) -> str | None:
        icon = next(
            (asset for asset in category.media.all() if asset.image_type == MediaAsset.ImageType.CATEGORY_ICON), None
        )
        return icon.file.url if icon else None
