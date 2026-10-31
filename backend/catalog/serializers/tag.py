from catalog.models import Tag
from catalog.serializers.base import ModelCleanSerializer


class TagSerializer(ModelCleanSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug", "is_featured", "is_active", "categories"]
