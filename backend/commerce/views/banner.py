from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny

from catalog.models import MediaAsset
from commerce.models import Banner
from commerce.serializers import BannerSerializer, PublicBannerSerializer


class BannerListView(generics.ListAPIView):
    """``GET /api/banners/?position=`` — active banners inside their time window (public)."""

    permission_classes = [AllowAny]
    serializer_class = PublicBannerSerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        banners = Banner.visible_at(timezone.now()).select_related("image")
        if position := self.request.query_params.get("position"):
            banners = banners.filter(position=position)
        return banners


class AdminBannerViewSet(viewsets.ModelViewSet):
    """``/api/admin/banners/`` — read with ``banners.view``, write with ``banners.manage``."""

    serializer_class = BannerSerializer
    queryset = Banner.objects.select_related("image")
    rbac_permissions = {
        "list": "banners.view",
        "retrieve": "banners.view",
        "create": "banners.manage",
        "update": "banners.manage",
        "partial_update": "banners.manage",
        "destroy": "banners.manage",
    }

    def perform_destroy(self, banner: Banner) -> None:
        MediaAsset.release(banner=banner)
        banner.delete()
