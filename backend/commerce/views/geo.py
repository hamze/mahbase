from django.db.models import QuerySet
from rest_framework import generics
from rest_framework.permissions import AllowAny

from commerce.models import City, Province
from commerce.serializers import CitySerializer, ProvinceSerializer


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
        cities = City.objects.filter(is_active=True, province__is_active=True)
        if province_id := self.request.query_params.get("province_id"):
            cities = cities.filter(province_id=province_id)
        return cities
