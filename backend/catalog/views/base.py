from django.db import models, transaction
from rest_framework import status, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

WRITE_ACTIONS = ("create", "update", "partial_update", "destroy")


class CatalogMetadataViewSet(viewsets.ModelViewSet):
    """CRUD for catalog metadata guarded by one ``<entity>.manage`` permission.

    DELETE hard-deletes unreferenced rows (204) and deactivates referenced ones (200 with ``deactivated``),
    so products and order history keep their references.
    """

    manage_permission: str

    @property
    def rbac_permissions(self) -> dict[str, str]:
        return {action: self.manage_permission for action in WRITE_ACTIONS}

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance = self.get_object()
        with transaction.atomic():
            if instance.is_referenced():
                instance.is_active = False
                instance.save(update_fields=["is_active"])
                return Response({"id": instance.pk, "deactivated": True}, status=status.HTTP_200_OK)
            self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def filter_by_category(self, queryset: models.QuerySet) -> models.QuerySet:
        category = self.request.query_params.get("category")
        return queryset.filter(categories=category) if category else queryset
