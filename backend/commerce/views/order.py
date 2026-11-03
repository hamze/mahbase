from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomer
from commerce.models import Order, OrderItem, ReturnRequest
from commerce.serializers import (
    OrderCreateSerializer,
    OrderListSerializer,
    OrderRefundSerializer,
    OrderSerializer,
    ReturnRequestCreateSerializer,
    ReturnRequestSerializer,
)
from commerce.services.checkout import CheckoutRejected, IdempotencyKeyReused, place_order, request_fingerprint
from commerce.services.payment_gateway.provider import get_payment_gateway


def order_detail_queryset() -> QuerySet:
    return Order.objects.select_related("user", "address_snapshot").prefetch_related(
        "items", "payments", "refunds", "return_requests__items__order_item", "return_requests__order_refund"
    )


def idempotency_key_reused_response() -> Response:
    return Response(
        {"detail": "This Idempotency-Key was already used for a different request."}, status=status.HTTP_409_CONFLICT
    )


class OrderCreateView(APIView):
    """``POST /api/orders/`` with an ``Idempotency-Key`` header — final confirmation that reserves stock.

    201 with the new order and ``payment_redirect_url``; 200 with the same order for a repeated key and body;
    409 for a repeated key with a different body; 422 with per-line errors when any line fails (nothing is reserved and the cart is unchanged).
    """

    permission_classes = [IsCustomer]

    def post(self, request: Request) -> Response:
        idempotency_key = request.headers.get("Idempotency-Key", "").strip()
        if not idempotency_key or len(idempotency_key) > 64:
            return Response({"detail": "An Idempotency-Key header (max 64 characters) is required."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            order, created = place_order(
                request.user,
                idempotency_key,
                data["address"],
                data["shipping_method"],
                data["discount_code"],
                request_fingerprint(request.data),
            )
        except CheckoutRejected as exc:
            return Response(exc.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except IdempotencyKeyReused:
            return idempotency_key_reused_response()
        order = order_detail_queryset().get(pk=order.pk)
        return Response(
            {
                "order_number": order.order_number,
                "payment_redirect_url": get_payment_gateway().payment_url(order),
                "order": OrderSerializer(order).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MyOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """``/api/me/orders/`` — own orders by order number, plus refund (cancel before shipping) and return requests."""

    permission_classes = [IsCustomer]
    lookup_field = "order_number"

    def get_queryset(self) -> QuerySet:
        return order_detail_queryset().filter(user=self.request.user)

    def get_serializer_class(self) -> type:
        return OrderListSerializer if self.action == "list" else OrderSerializer

    def _locked_order(self, order_number: str) -> Order:
        return get_object_or_404(Order.objects.select_for_update(), user=self.request.user, order_number=order_number)

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request: Request, order_number: str) -> Response:
        """Payment link for an unpaid order that still holds its reservation (also after a failed attempt)."""
        with transaction.atomic():
            order = self._locked_order(order_number)
            if order.stock_reservation_status != Order.ReservationStatus.RESERVED or order.payment_status not in (
                Order.PaymentStatus.UNPAID, Order.PaymentStatus.FAILED
            ):
                return Response({"detail": "This order cannot be paid."}, status=status.HTTP_409_CONFLICT)
            order.payment_status = Order.PaymentStatus.PENDING
            order.save(update_fields=["payment_status", "updated_at"])
        return Response({"payment_redirect_url": get_payment_gateway().payment_url(order)})

    @action(detail=True, methods=["post"], url_path="refund-request")
    def refund_request(self, request: Request, order_number: str) -> Response:
        with transaction.atomic():
            refund = self._locked_order(order_number).request_cancellation_refund(request.user)
        return Response(OrderRefundSerializer(refund).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="return-request")
    def return_request(self, request: Request, order_number: str) -> Response:
        serializer = ReturnRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            order = self._locked_order(order_number)
            return_request = open_return(order, serializer.validated_data, request.user)
        return Response(ReturnRequestSerializer(return_request).data, status=status.HTTP_201_CREATED)


def open_return(order: Order, data: dict, requested_by: User) -> ReturnRequest:
    """Shared by customer and admin return requests (order locked by caller); ``ReturnRequest.open`` validates."""
    order_items = OrderItem.objects.in_bulk([line["order_item"] for line in data["items"]])
    if len(order_items) != len({line["order_item"] for line in data["items"]}):
        raise ValidationError({"items": "Unknown order item."})
    lines = [(order_items[line["order_item"]], line["quantity"]) for line in data["items"]]
    return ReturnRequest.open(order, data["reason"], lines, requested_by)
