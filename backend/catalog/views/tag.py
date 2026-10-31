from django.db.models import QuerySet

from catalog.models import Tag
from catalog.serializers import TagSerializer
from catalog.views.base import CatalogMetadataViewSet


class TagViewSet(CatalogMetadataViewSet):
    serializer_class = TagSerializer
    manage_permission = "tags.manage"

    def get_queryset(self) -> QuerySet:
        category = self.request.query_params.get("category")
        tags = Tag.for_category(category) if category else Tag.objects.all()
        return tags.prefetch_related("categories")
