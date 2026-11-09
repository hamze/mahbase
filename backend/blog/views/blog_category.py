from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from blog.models import BlogCategory
from blog.serializers import BlogCategorySerializer, PublicBlogCategorySerializer


class PublicBlogCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """``GET /api/blog/categories/[{slug}/]`` — active, non-internal categories (public)."""

    permission_classes = [AllowAny]
    serializer_class = PublicBlogCategorySerializer
    lookup_field = "slug"
    queryset = BlogCategory.objects.filter(is_active=True, is_internal=False)


class AdminBlogCategoryViewSet(viewsets.ModelViewSet):
    """``/api/admin/blog/categories/`` (``blog.manage_categories``); DELETE is refused while posts reference it."""

    serializer_class = BlogCategorySerializer
    queryset = BlogCategory.objects.all()

    @property
    def rbac_permissions(self) -> dict[str, str]:
        return {self.action: "blog.manage_categories"}
