from catalog.models import Unit
from catalog.serializers import UnitSerializer
from catalog.views.base import CatalogMetadataViewSet


class UnitViewSet(CatalogMetadataViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    manage_permission = "units.manage"
