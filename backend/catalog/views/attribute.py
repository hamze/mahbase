from django.db.models import QuerySet

from catalog.models import Attribute
from catalog.serializers import AttributeSerializer
from catalog.views.base import CatalogMetadataViewSet


class AttributeViewSet(CatalogMetadataViewSet):
    serializer_class = AttributeSerializer
    manage_permission = "attributes.manage"

    def get_queryset(self) -> QuerySet:
        return self.filter_by_category(Attribute.objects.prefetch_related("categories", "options"))
