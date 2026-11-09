import logging

from django.db.models import Count, QuerySet
from rest_framework import viewsets

from accounts.models import Group
from accounts.serializers import AccessGroupSerializer

logger = logging.getLogger(__name__)


class AccessGroupViewSet(viewsets.ModelViewSet):
    """``/api/access/groups/``: read with ``access.view``, write with ``access.manage_groups``.
    PUT replaces the permission set atomically; DELETE is refused for system groups.
    """

    serializer_class = AccessGroupSerializer
    rbac_permissions = {
        "list": "access.view",
        "retrieve": "access.view",
        "create": "access.manage_groups",
        "update": "access.manage_groups",
        "partial_update": "access.manage_groups",
        "destroy": "access.manage_groups",
    }

    def get_queryset(self) -> QuerySet:
        return Group.objects.prefetch_related("permissions").annotate(
            user_count=Count("memberships", distinct=True), permission_count=Count("permissions", distinct=True)
        ).order_by("id")

    def perform_update(self, serializer: AccessGroupSerializer) -> None:
        group = serializer.save()
        logger.info(f"User {self.request.user.pk} updated group {group.pk}")
