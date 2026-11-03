from django.db.models import QuerySet
from rest_framework import viewsets

from commerce.models import AuditLog
from commerce.serializers import AuditLogSerializer
from commerce.views.base import AdminPermissionMixin


class AdminAuditLogViewSet(AdminPermissionMixin, viewsets.ReadOnlyModelViewSet):
    """``/api/admin/audit-log/?target_type=&target_id=`` (``admin.audit.view``)."""

    serializer_class = AuditLogSerializer
    manage_permission = "admin.audit.view"

    def get_queryset(self) -> QuerySet:
        entries = AuditLog.objects.select_related("actor")
        params = self.request.query_params
        if target_type := params.get("target_type"):
            entries = entries.filter(target_type=target_type)
        if target_id := params.get("target_id"):
            entries = entries.filter(target_id=target_id)
        return entries
