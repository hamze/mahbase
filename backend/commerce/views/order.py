import logging

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
    OrderQuoteRequestSerializer,
    OrderQuoteSerializer,
    OrderSerializer,
    ReturnRequestCreateSerializer,
    ReturnRequestSerializer,
)
from commerce.services.cart import priced_lines
from commerce.services.checkout import (
    CheckoutRejected,
    IdempotencyKeyReused,
    place_order,
    quote_order,
    request_fingerprint,
)
from commerce.services.payments import start_payment
from config.api import Responses

logger = logging.getLogger(__name__)


def order_detail_queryset() -> QuerySet:
    return Order.objects.select_related("user", "address_snapshot").prefetch_related(
        "items", "payments", "refunds", "return_requests__items__order_item", "return_requests__order_refund"
    )


def payment_link(order: Order) -> str | None:
    """A new bank link for the order, or None when the bank request fails (logged)."""
    try:
        return start_payment(order)
    except Exception as e:
        logger.error(f"Payment request for order {order.order_number} failed: {str(e)}", exc_info=True)
        return None


def idempotency_key_reused_response() -> Response:
    return Responses.get_response(Responses.GENERAL.IDEMPOTENCY_KEY_REUSED)


class OrderCreateView(APIView):
    """``POST /api/orders/`` with an ``Idempotency-Key`` header — final confirmation that reserves stock.

    201 with the new order and ``payment_redirect_url`` (a fresh bank link, null while the bank is unreachable: the
    customer retries with ``/pay/``); 200 with the same order for a repeated key and body;
    409 for a repeated key with a different body; 422 with per-line errors when any line fails (nothing is reserved and the cart is unchanged).
    """

    permission_classes = [IsCustomer]

    def post(self, request: Request) -> Response:
        idempotency_key = request.headers.get("Idempotency-Key", "").strip()
        if not idempotency_key or len(idempotency_key) > 64:
            return Responses.get_response(Responses.GENERAL.IDEMPOTENCY_KEY_REQUIRED)
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
            return Responses.get_response(Responses.ORDER.ITEMS_REJECTED, exc.errors)
        except IdempotencyKeyReused:
            return idempotency_key_reused_response()
        payment_redirect_url = payment_link(order)
        order = order_detail_queryset().get(pk=order.pk)
        return Response(
            {
                "order_number": order.order_number,
                "payment_redirect_url": payment_redirect_url,
                "order": OrderSerializer(order).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class OrderQuoteView(APIView):
    """``POST /api/orders/quote/`` — the totals of the current cart for a shipping method and discount code, with
    packaging and tax, exactly as confirmation computes them (checkout summary). Never changes state.
    """

    permission_classes = [IsCustomer]

    def post(self, request: Request) -> Response:
        serializer = OrderQuoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = quote_order(request.user, priced_lines(request), data["shipping_method"], data["discount_code"])
        return Response(OrderQuoteSerializer(order).data)


class MyOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """``/api/me/orders/`` — own orders by order number, payment retry and return requests. Cancelling is admin-only."""

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
        """Bank link for an unpaid order that still holds its reservation (also after a failed or abandoned attempt).

        502 while the bank is unreachable.
        """
        with transaction.atomic():
            order = self._locked_order(order_number)
            if order.stock_reservation_status != Order.ReservationStatus.RESERVED or order.payment_status not in (
                Order.PaymentStatus.UNPAID, Order.PaymentStatus.PENDING, Order.PaymentStatus.FAILED
            ):
                return Responses.get_response(Responses.ORDER.NOT_PAYABLE)
            order.payment_status = Order.PaymentStatus.PENDING
            order.save(update_fields=["payment_status", "updated_at"])
        url = payment_link(order)
        if url is None:
            return Responses.get_response(Responses.ORDER.GATEWAY_ERROR)
        return Response({"payment_redirect_url": url})

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
        raise ValidationError({"items": "قلم سفارش نامعتبر است."})
    lines = [(order_items[line["order_item"]], line["quantity"]) for line in data["items"]]
    return ReturnRequest.open(order, data["reason"], lines, requested_by)
