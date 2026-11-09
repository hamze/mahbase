from django.db.models import ProtectedError, QuerySet
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import City, Province
from commerce.serializers import AdminCitySerializer, AdminProvinceSerializer, CitySerializer, ProvinceSerializer
from commerce.views.base import AdminPermissionMixin


class ProvinceListView(generics.ListAPIView):
    """``GET /api/geo/provinces/`` — active provinces (public)."""

    permission_classes = [AllowAny]
    serializer_class = ProvinceSerializer
    pagination_class = None
    queryset = Province.objects.filter(is_active=True)


class CityListView(generics.ListAPIView):
    """``GET /api/geo/cities/?province_id=`` — active cities (public)."""

    permission_classes = [AllowAny]
    serializer_class = CitySerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        cities = City.objects.filter(is_active=True, province__is_active=True).select_related("province")
        if province_id := self.request.query_params.get("province_id"):
            cities = cities.filter(province_id=province_id)
        return cities


class GeoDestroyMixin:
    """DELETE removes an unused row and deactivates one that addresses, cities or shipping methods still reference."""

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        row = self.get_object()
        try:
            row.delete()
        except ProtectedError:
            row.is_active = False
            row.save(update_fields=["is_active"])
            return Response({"id": row.pk, "deactivated": True})
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminProvinceViewSet(AdminPermissionMixin, GeoDestroyMixin, viewsets.ModelViewSet):
    """``/api/admin/provinces/`` — all provinces, active or not."""

    serializer_class = AdminProvinceSerializer
    manage_permission = "geo.manage"
    queryset = Province.objects.all()


class AdminCityViewSet(AdminPermissionMixin, GeoDestroyMixin, viewsets.ModelViewSet):
    """``/api/admin/cities/?province=&search=`` — all cities, active or not."""

    serializer_class = AdminCitySerializer
    manage_permission = "geo.manage"

    def get_queryset(self) -> QuerySet:
        cities = City.objects.select_related("province")
        if province := self.request.query_params.get("province"):
            cities = cities.filter(province_id=province)
        if search := self.request.query_params.get("search"):
            cities = cities.filter(name__icontains=search)
        return cities
