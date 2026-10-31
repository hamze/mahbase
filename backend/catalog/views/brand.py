from django.db.models import QuerySet

from catalog.models import Brand, MediaAsset
from catalog.serializers import BrandSerializer
from catalog.views.base import CatalogMetadataViewSet


class BrandViewSet(CatalogMetadataViewSet):
    serializer_class = BrandSerializer
    manage_permission = "brands.manage"

    def get_queryset(self) -> QuerySet:
        category = self.request.query_params.get("category")
        brands = Brand.for_category(category) if category else Brand.objects.all()
        return brands.select_related("logo").prefetch_related("categories")

    def perform_destroy(self, brand: Brand) -> None:
        MediaAsset.release(brand=brand)
        brand.delete()
