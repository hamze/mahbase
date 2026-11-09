from rest_framework import mixins, viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from catalog.models import MediaAsset
from catalog.serializers import MediaUploadSerializer


class MediaUploadViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """``POST /api/media/upload/``: returns the new asset; TEMPORARY when no owner is given."""

    queryset = MediaAsset.objects.all()
    serializer_class = MediaUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
    # Every editor that attaches images (products, categories, brands, blog, banners, settings) uploads through this endpoint.
    rbac_permissions = {
        "create": (
            "media.manage",
            "products.create",
            "products.edit",
            "categories.manage",
            "brands.manage",
            "blog.create",
            "blog.edit",
            "banners.manage",
            "settings.edit",
        )
    }
