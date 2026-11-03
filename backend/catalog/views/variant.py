import logging

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from catalog.models import ProductVariant, StockBelowReserved
from catalog.serializers import (
    PriceAdjustmentSerializer,
    PriceUpdateSerializer,
    ProductVariantSerializer,
    StockUpdateSerializer,
)

logger = logging.getLogger(__name__)


class VariantViewSet(viewsets.GenericViewSet):
    """Stock and price management of variants.

    ``PATCH /api/variants/{id}/stock/`` sets or adjusts stock under a row lock; stock below the reserved quantity
    returns 409 with the affected reserved orders unless ``confirm`` is true, which invalidates those orders,
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
        from commerce.models import AuditLog, Order

        serializer = StockUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            # Orders before the variant: the same lock order as payment and expiry (order → variants).
            Order.lock_reserved_for_variant(variant.pk)
            try:
                variant = ProductVariant.update_stock(
                    variant.pk,
                    quantity=data.get("stock_quantity"),
                    delta=data.get("delta"),
                    allow_below_reserved=data["confirm"],
                )
            except StockBelowReserved as exc:
                return Response(
                    {
                        "warning": "stock_below_reserved",
                        "requested": exc.requested,
                        "reserved_quantity": exc.variant.reserved_quantity,
                        "shortfall": exc.shortfall,
                        "affected_orders": Order.reserved_on_variant(variant.pk),
                        "action_required": "confirm",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if variant.available_quantity < 0:
                affected = Order.invalidate_reserved_on_variant(variant.pk)
                AuditLog.record(
                    request.user,
                    "variant.stock_below_reserved_confirmed",
                    variant,
                    stock_quantity=variant.stock_quantity,
                    reserved_quantity=variant.reserved_quantity,
                    invalidated_orders=affected,
                )
                logger.warning(
                    f"User {request.user.pk} set stock of variant {variant.pk} below its reservation; "
                    f"invalidated orders {[row['order_number'] for row in affected]}"
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
