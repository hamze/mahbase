from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.serializers import BaseSerializer

from catalog.models import Attribute, AttributeOption
from catalog.serializers import AttributeOptionSerializer
from catalog.views.base import CatalogMetadataViewSet


class AttributeOptionViewSet(CatalogMetadataViewSet):
    """Options nested under ``/attributes/{attribute_pk}/options/``."""

    serializer_class = AttributeOptionSerializer
    manage_permission = "attributes.manage"

    def get_queryset(self) -> QuerySet:
        return AttributeOption.objects.filter(attribute_id=self.kwargs["attribute_pk"]).select_related("attribute")

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(attribute=get_object_or_404(Attribute, pk=self.kwargs["attribute_pk"]))
