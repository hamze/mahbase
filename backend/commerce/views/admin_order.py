import logging

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import UserProfile
from accounts.serializers import AdminUserSerializer
from commerce.models import Address, AuditLog, Order, OrderItem
from commerce.serializers import (
    AddressSerializer,
    AdminOrderCreateSerializer,
    OrderItemSerializer,
    OrderListSerializer,
    OrderRefundSerializer,
    OrderSerializer,
    ReturnRequestCreateSerializer,
    OrderVariantOptionSerializer,
    ReturnRequestSerializer,
)
from commerce.services.cart import line_variants
from commerce.services.checkout import (
    ADMIN_KEY_PREFIX,
    CheckoutRejected,
    IdempotencyKeyReused,
    find_admin_order,
    place_admin_order,
    request_fingerprint,
)
from commerce.services.payment_gateway.provider import get_payment_gateway
from commerce.views.base import AdminPermissionMixin
from commerce.views.order import idempotency_key_reused_response, open_return, order_detail_queryset

logger = logging.getLogger(__name__)

SEARCH_LIMIT = 20


class AdminOrderViewSet(AdminPermissionMixin, viewsets.ReadOnlyModelViewSet):
    """``/api/admin/orders/`` — all orders; status changes follow ``Order.MANUAL_TRANSITIONS`` (409 otherwise).

    ``cancel`` releases an unpaid order or opens an approved full refund for a paid, unshipped one; the order is
    cancelled only when that refund completes.

    ``POST`` (``admin.orders.create``, ``Idempotency-Key`` header) places an order for an existing or a new customer;
    the ``customers``, ``customers/{id}/addresses`` and ``variants`` lookups feed that form.
    """

    lookup_field = "order_number"
    manage_permission = "admin.orders.view_all"
    rbac_action_permissions = {
        "status": "admin.orders.status",
        "cancel": "admin.orders.cancel",
        "preparation_status": "admin.orders.edit",
        "return_request": "admin.returns.approve",
        "create": "admin.orders.create",
        "customers": "admin.orders.create",
        "customer_addresses": "admin.orders.create",
        "variants": "admin.orders.create",
    }

    def get_queryset(self) -> QuerySet:
        orders = order_detail_queryset()
        params = self.request.query_params
        if order_status := params.get("order_status"):
            orders = orders.filter(order_status=order_status)
        if payment_status := params.get("payment_status"):
            orders = orders.filter(payment_status=payment_status)
        if search := params.get("search"):
            orders = orders.filter(Q(order_number__icontains=search) | Q(user__username__icontains=search))
        return orders

    def get_serializer_class(self) -> type:
        return OrderListSerializer if self.action == "list" else OrderSerializer

    def _locked(self, order_number: str) -> Order:
        return get_object_or_404(Order.objects.select_for_update(), order_number=order_number)

    def _detail(self, order: Order) -> Response:
        return Response(OrderSerializer(order_detail_queryset().get(pk=order.pk)).data)

    def create(self, request: Request) -> Response:
        """201 with the order and its payment link for the customer; 200 for a repeated key and body (409 for a
        different body); 422 per-line errors."""
        idempotency_key = request.headers.get("Idempotency-Key", "").strip()
        max_length = Order._meta.get_field("idempotency_key").max_length - len(ADMIN_KEY_PREFIX)
        if not idempotency_key or len(idempotency_key) > max_length:
            return Response(
                {"detail": f"An Idempotency-Key header (max {max_length} characters) is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        fingerprint = request_fingerprint(request.data)
        try:
            if order := find_admin_order(idempotency_key, fingerprint):
                return self._created(order, created=False)
        except IdempotencyKeyReused:
            return idempotency_key_reused_response()
        serializer = AdminOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            order, created = place_admin_order(
                request.user,
                idempotency_key,
                fingerprint,
                customer=data.get("customer"),
                new_customer=data.get("new_customer"),
                address_id=data.get("address"),
                new_address=data.get("new_address"),
                shipping_method_id=data["shipping_method"],
                discount_code=data["discount_code"],
                lines={line["variant"]: line["quantity"] for line in data["items"]},
            )
        except CheckoutRejected as exc:
            return Response(exc.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except IdempotencyKeyReused:
            return idempotency_key_reused_response()
        return self._created(order, created=created)

    def _created(self, order: Order, *, created: bool) -> Response:
        order = order_detail_queryset().get(pk=order.pk)
        return Response(
            {
                "order_number": order.order_number,
                "payment_redirect_url": get_payment_gateway().payment_url(order),
                "order": OrderSerializer(order).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def customers(self, request: Request) -> Response:
        """Active customers matching ``search`` (mobile or name), for the order form's customer picker."""
        users = User.objects.filter(profile__isnull=False, is_active=True).select_related("profile").order_by("-id")
        if search := request.query_params.get("search", "").strip():
            users = users.filter(
                Q(username__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        return Response(AdminUserSerializer(users[:SEARCH_LIMIT], many=True).data)

    @action(detail=False, methods=["get"], url_path=r"customers/(?P<user_id>\d+)/addresses")
    def customer_addresses(self, request: Request, user_id: str) -> Response:
        addresses = Address.objects.active().filter(user_id=user_id).select_related("province", "city")
        return Response(AddressSerializer(addresses, many=True).data)

    @action(detail=False, methods=["get"])
    def variants(self, request: Request) -> Response:
        """Sellable variants matching ``search`` (SKU or product name), priced for ``customer_tier``."""
        tier = serializers.ChoiceField(choices=UserProfile.CustomerTier.choices).run_validation(
            request.query_params.get("customer_tier", UserProfile.CustomerTier.RETAIL)
        )
        variants = line_variants().filter(product__is_published=True, product__deleted_at=None).order_by("product__name", "sku")
        if search := request.query_params.get("search", "").strip():
            variants = variants.filter(Q(sku__icontains=search) | Q(product__name__icontains=search))
        return Response(OrderVariantOptionSerializer(variants[:SEARCH_LIMIT], many=True, context={"tier": tier}).data)

    @action(detail=True, methods=["patch"])
    def status(self, request: Request, order_number: str) -> Response:
        new_status = serializers.ChoiceField(choices=Order.Status.choices).run_validation(request.data.get("order_status"))
        with transaction.atomic():
            order = self._locked(order_number)
            previous = order.order_status
            order.transition_status(new_status, manual=True)
            order.save(update_fields=["order_status", "updated_at"])
            AuditLog.record(request.user, "order.status", order, previous=previous, new=new_status)
        return self._detail(order)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, order_number: str) -> Response:
        with transaction.atomic():
            order = self._locked(order_number)
            if order.order_status == Order.Status.PENDING_PAYMENT and order.payment_status != Order.PaymentStatus.PAID:
                order.cancel_unpaid_by_admin()
                AuditLog.record(request.user, "order.cancel_unpaid", order)
                refund = None
            else:
                refund = order.request_cancellation_refund(request.user, approved_by=request.user)
                AuditLog.record(request.user, "order.cancel_with_refund", order, refund=refund.pk, amount=refund.amount)
        if refund is not None:
            return Response(OrderRefundSerializer(refund).data, status=status.HTTP_201_CREATED)
        return self._detail(order)

    @action(detail=True, methods=["patch"], url_path=r"items/(?P<item_id>\d+)/preparation-status")
    def preparation_status(self, request: Request, order_number: str, item_id: str) -> Response:
        new_status = serializers.ChoiceField(choices=OrderItem.PreparationStatus.choices).run_validation(
            request.data.get("preparation_status")
        )
        item = get_object_or_404(OrderItem, pk=item_id, order__order_number=order_number)
        item.transition_preparation_status(new_status)
        item.save(update_fields=["preparation_status"])
        return Response(OrderItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="return-request")
    def return_request(self, request: Request, order_number: str) -> Response:
        serializer = ReturnRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            order = self._locked(order_number)
            return_request = open_return(order, serializer.validated_data, request.user)
            AuditLog.record(request.user, "return.opened_by_admin", return_request)
        return Response(ReturnRequestSerializer(return_request).data, status=status.HTTP_201_CREATED)
