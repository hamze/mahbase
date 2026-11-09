import logging

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from accounts.permissions import IsCustomer
from catalog.models import Product
from commerce.models import ProductReview
from commerce.permissions import ReviewsEnabled
from commerce.serializers import ProductReviewSerializer, PublicProductReviewSerializer, ReviewRejectSerializer

logger = logging.getLogger(__name__)


class ProductReviewListView(generics.ListCreateAPIView):
    """``GET /api/products/{slug}/reviews/`` — approved reviews (public); ``POST`` — a customer with a delivered
    order of the product submits a PENDING review. Both are refused while reviews are disabled.
    """

    serializer_class = PublicProductReviewSerializer

    def get_permissions(self) -> list:
        return [ReviewsEnabled(), IsCustomer() if self.request.method == "POST" else AllowAny()]

    def get_product(self) -> Product:
        return get_object_or_404(Product, slug=self.kwargs["slug"], is_published=True, deleted_at__isnull=True)

    def get_queryset(self) -> QuerySet:
        return ProductReview.objects.filter(
            product=self.get_product(), status=ProductReview.Status.APPROVED
        ).select_related("user")

    def perform_create(self, serializer: BaseSerializer) -> None:
        data = serializer.validated_data
        serializer.instance = ProductReview.submit(
            self.request.user, self.get_product(), rating=data["rating"], title=data.get("title"), body=data["body"]
        )


class AdminProductReviewViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """``/api/reviews/?status=&product=`` — moderation (``reviews.view`` / ``reviews.moderate`` / ``reviews.delete``)."""

    serializer_class = ProductReviewSerializer
    rbac_permissions = {
        "list": "reviews.view",
        "retrieve": "reviews.view",
        "approve": "reviews.moderate",
        "reject": "reviews.moderate",
        "destroy": "reviews.delete",
    }

    def get_queryset(self) -> QuerySet:
        reviews = ProductReview.objects.select_related("product", "user", "order")
        params = self.request.query_params
        if review_status := params.get("status"):
            reviews = reviews.filter(status=review_status)
        if product := params.get("product"):
            reviews = reviews.filter(product_id=product)
        return reviews

    @action(detail=True, methods=["patch"])
    def approve(self, request: Request, pk: str) -> Response:
        review = self.get_object()
        review.approve(request.user)
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=["patch"])
    def reject(self, request: Request, pk: str) -> Response:
        review = self.get_object()
        serializer = ReviewRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review.reject(request.user, serializer.validated_data["reject_reason"])
        return Response(self.get_serializer(review).data)

    def perform_destroy(self, review: ProductReview) -> None:
        logger.info(f"User {self.request.user.pk} deleted review {review.pk}")
        review.delete()
