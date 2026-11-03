from django.db.models import QuerySet
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import FAQ, FAQCategory
from commerce.serializers import FAQCategorySerializer, FAQSerializer
from commerce.views.base import AdminPermissionMixin


class FAQCategoryListView(generics.ListAPIView):
    """``GET /api/faq-categories/`` (public, active only)."""

    permission_classes = [AllowAny]
    serializer_class = FAQCategorySerializer
    pagination_class = None
    queryset = FAQCategory.objects.filter(is_active=True)


class FAQListView(generics.ListAPIView):
    """``GET /api/faqs/?category=`` (public, active only)."""

    permission_classes = [AllowAny]
    serializer_class = FAQSerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        faqs = FAQ.objects.filter(is_active=True, category__is_active=True)
        if category := self.request.query_params.get("category"):
            faqs = faqs.filter(category_id=category)
        return faqs


class AdminFAQCategoryViewSet(AdminPermissionMixin, viewsets.ModelViewSet):
    serializer_class = FAQCategorySerializer
    manage_permission = "admin.faqs.manage"
    queryset = FAQCategory.objects.all()

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """A category that still has FAQs is deactivated instead of deleted."""
        category = self.get_object()
        if category.faqs.exists():
            category.is_active = False
            category.save(update_fields=["is_active"])
            return Response({"id": category.pk, "deactivated": True})
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminFAQViewSet(AdminPermissionMixin, viewsets.ModelViewSet):
    serializer_class = FAQSerializer
    manage_permission = "admin.faqs.manage"
    queryset = FAQ.objects.all()

    def perform_create(self, serializer: FAQSerializer) -> None:
        serializer.save(created_by_admin=self.request.user)
