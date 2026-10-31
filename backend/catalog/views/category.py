from django.db.models import QuerySet

from catalog.models import Category, MediaAsset
from catalog.serializers import CategorySerializer
from catalog.views.base import CatalogMetadataViewSet


class CategoryViewSet(CatalogMetadataViewSet):
    serializer_class = CategorySerializer
    manage_permission = "categories.manage"

    def get_queryset(self) -> QuerySet:
        return Category.objects.prefetch_related("media")

    def perform_destroy(self, category: Category) -> None:
        MediaAsset.release(category=category)
        category.delete()
