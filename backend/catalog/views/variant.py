import logging

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from catalog.models import ProductVariant
from catalog.serializers import (
    PriceAdjustmentSerializer,
    PriceUpdateSerializer,
    ProductVariantSerializer,
    StockUpdateSerializer,
)

logger = logging.getLogger(__name__)


class VariantViewSet(viewsets.GenericViewSet):
    """Stock and price management of variants.

    ``PATCH /api/variants/{id}/stock/`` sets or adjusts stock under a row lock,
    ``PATCH /api/variants/{id}/price/`` updates price fields only,
    ``POST /api/variants/adjust-prices/`` scales all (or one category's) prices by a percentage.
    """

    queryset = ProductVariant.objects.all()
    rbac_permissions = {
        "stock": "products.edit_stock",
        "price": "products.edit_price",
        "adjust_prices": "products.edit_price",
    }

    @action(detail=True, methods=["patch"])
    def stock(self, request: Request, pk: str) -> Response:
        variant = self.get_object()
        serializer = StockUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = ProductVariant.update_stock(
            variant.pk,
            quantity=serializer.validated_data.get("stock_quantity"),
            delta=serializer.validated_data.get("delta"),
        )
        return Response(ProductVariantSerializer(variant, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["patch"])
    def price(self, request: Request, pk: str) -> Response:
        variant = self.get_object()
        serializer = PriceUpdateSerializer(variant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProductVariantSerializer(variant, context=self.get_serializer_context()).data)

    @action(detail=False, methods=["post"], url_path="adjust-prices")
    def adjust_prices(self, request: Request) -> Response:
        serializer = PriceAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        percentage = serializer.validated_data["percentage"]
        category = serializer.validated_data.get("category")
        updated = ProductVariant.adjust_prices(percentage, category.pk if category else None)
        logger.info(
            f"User {request.user.pk} adjusted prices by {percentage}% "
            f"(category={category.pk if category else 'all'}): {updated} variants"
        )
        return Response({"updated": updated})
