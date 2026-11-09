import logging

from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import StoreSettings
from commerce.serializers import PublicStoreSettingsSerializer, StoreSettingsSerializer

logger = logging.getLogger(__name__)


class StoreSettingsViewSet(viewsets.ViewSet):
    """``GET /api/settings/`` — public safe projection; ``PUT`` — full validated update (``settings.edit``)."""

    rbac_permissions = {"update": "settings.edit"}

    def get_permissions(self) -> list:
        return [AllowAny()] if self.action == "retrieve" else super().get_permissions()

    def retrieve(self, request: Request) -> Response:
        return Response(PublicStoreSettingsSerializer(StoreSettings.get_solo()).data)

    def update(self, request: Request) -> Response:
        serializer = StoreSettingsSerializer(StoreSettings.get_solo(), data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f"User {request.user.pk} updated store settings")
        return Response(serializer.data)


class AdminStoreSettingsViewSet(viewsets.ViewSet):
    """``GET /api/admin/settings/`` — every field, for the settings form (``settings.view``)."""

    rbac_permissions = {"retrieve": "settings.view"}

    def retrieve(self, request: Request) -> Response:
        return Response(StoreSettingsSerializer(StoreSettings.get_solo()).data)
