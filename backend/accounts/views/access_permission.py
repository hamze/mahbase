from django.db.models import QuerySet
from rest_framework import viewsets

from accounts.models import Permission
from accounts.serializers import AccessPermissionSerializer


class AccessPermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """``GET /api/access/permissions/?module=`` (``access.view``)."""

    serializer_class = AccessPermissionSerializer
    rbac_permissions = {"list": "access.view", "retrieve": "access.view"}

    def get_queryset(self) -> QuerySet:
        permissions = Permission.objects.all()
        if module := self.request.query_params.get("module"):
            permissions = permissions.filter(module=module)
        return permissions
