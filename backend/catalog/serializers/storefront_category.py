from rest_framework import serializers

from catalog.models import Category
from catalog.serializers.category import CategorySerializer


class StorefrontCategorySerializer(serializers.ModelSerializer):
    """Active category with its active subcategories (the tree is two levels deep)."""

    icon_url = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent", "seo_title", "seo_description", "icon_url", "children"]
        read_only_fields = fields

    def get_icon_url(self, category: Category) -> str | None:
        return CategorySerializer().get_icon_url(category)

    def get_children(self, category: Category) -> list[dict]:
        children = [child for child in category.children.all() if child.is_active]
        return StorefrontCategorySerializer(children, many=True, context=self.context).data
