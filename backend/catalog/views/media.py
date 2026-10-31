from rest_framework import mixins, viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from catalog.models import MediaAsset
from catalog.serializers import MediaUploadSerializer


class MediaUploadViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """``POST /api/media/upload/``: returns the new asset; TEMPORARY when no owner is given."""

    queryset = MediaAsset.objects.all()
    serializer_class = MediaUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
    rbac_permissions = {"create": "media.manage"}
