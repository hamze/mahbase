from django.db.models import QuerySet
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import ShippingMethod
from commerce.serializers import ShippingMethodSerializer
from commerce.views.base import AdminPermissionMixin


class ShippingMethodListView(generics.ListAPIView):
    """``GET /api/shipping-methods/?city_id=`` — active methods serving a city (public)."""

    permission_classes = [AllowAny]
    serializer_class = ShippingMethodSerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        city_id = self.request.query_params.get("city_id")
        return ShippingMethod.available_for(city_id) if city_id else ShippingMethod.objects.filter(is_active=True)


class AdminShippingMethodViewSet(AdminPermissionMixin, viewsets.ModelViewSet):
    """``/api/admin/shipping-methods/``; DELETE only deactivates (orders keep the name/cost snapshot)."""

    serializer_class = ShippingMethodSerializer
    manage_permission = "admin.shipping.manage"
    queryset = ShippingMethod.objects.prefetch_related("cities")

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        method = self.get_object()
        method.is_active = False
        method.save(update_fields=["is_active"])
        return Response({"id": method.pk, "deactivated": True})
