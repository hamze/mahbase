from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Sum

from catalog.models.product_variant import CENT, PRICE
from commerce.models.order import InvalidTransition

if TYPE_CHECKING:
    from commerce.models import Order, OrderItem, OrderRefund


class ReturnRequest(models.Model):
    """Return of delivered goods: REQUESTED → APPROVED → RECEIVED → COMPLETED, or REJECTED / CANCELLED.

    Completing creates an ``OrderRefund(RETURN)``; restocking and ``returned_quantity`` apply when that refund
    completes, and the request then becomes COMPLETED.
    """

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED"
        APPROVED = "APPROVED"
        RECEIVED = "RECEIVED"
        COMPLETED = "COMPLETED"
        REJECTED = "REJECTED"
        CANCELLED = "CANCELLED"

    OPEN_STATUSES = (Status.REQUESTED, Status.APPROVED, Status.RECEIVED)

    order = models.ForeignKey("commerce.Order", on_delete=models.PROTECT, related_name="return_requests")
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REQUESTED)
    refund_amount = models.DecimalField(**PRICE, default=Decimal("0"))
    order_refund = models.OneToOneField(
        "commerce.OrderRefund", null=True, blank=True, on_delete=models.PROTECT, related_name="return_request"
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        permissions = [
            ("admin_returns_approve", "Can approve or reject return requests"),
            ("admin_returns_receive", "Can mark returned goods as received"),
            ("admin_returns_complete", "Can complete return requests"),
        ]

    @classmethod
    def open(cls, order: "Order", reason: str, items: list[tuple["OrderItem", Decimal]], requested_by: User) -> "ReturnRequest":
        """Open a request for ``(order_item, quantity)`` pairs of a delivered, paid order (order locked by caller)."""
        from commerce.models import Order, ReturnRequestItem

        if order.order_status != Order.Status.DELIVERED or order.payment_status not in (
            Order.PaymentStatus.PAID, Order.PaymentStatus.PARTIALLY_REFUNDED
        ):
            raise InvalidTransition("Only delivered, paid orders can be returned.")
        errors = []
        for order_item, quantity in items:
            pending = (
                ReturnRequestItem.objects.filter(order_item=order_item, return_request__status__in=cls.OPEN_STATUSES)
                .aggregate(total=Sum("quantity"))["total"]
                or 0
            )
            if order_item.order_id != order.pk:
                errors.append(f"Item {order_item.pk} does not belong to this order.")
            elif quantity <= 0 or quantity > order_item.quantity - order_item.returned_quantity - pending:
                errors.append(f"{order_item.sku_snapshot}: invalid return quantity.")
        if not items or errors:
            raise ValidationError({"items": errors or ["Select at least one item."]})
        request = cls.objects.create(order=order, reason=reason, requested_by=requested_by)
        ReturnRequestItem.objects.bulk_create(
            ReturnRequestItem(return_request=request, order_item=order_item, quantity=quantity)
            for order_item, quantity in items
        )
        return request

    def _lock(self) -> None:
        """Lock the order, then this request, and reload the state every transition checks (inside a transaction).

        Order first, as in every workflow that touches stock or refunds, so concurrent transitions serialize.
        """
        from commerce.models import Order

        Order.objects.select_for_update().get(pk=self.order_id)
        self.status, self.order_refund_id = (
            type(self).objects.select_for_update().values_list("status", "order_refund_id").get(pk=self.pk)
        )

    def _move(self, allowed_from: set[str], new_status: str) -> None:
        """Validate and save the status change under the lock."""
        with transaction.atomic():
            self._lock()
            if self.status not in allowed_from:
                raise InvalidTransition(f"Return request cannot change from {self.status} to {new_status}.")
            self.status = new_status
            self.save(update_fields=["status", "updated_at"])

    def approve(self) -> None:
        self._move({self.Status.REQUESTED}, self.Status.APPROVED)

    def reject(self) -> None:
        self._move({self.Status.REQUESTED, self.Status.APPROVED}, self.Status.REJECTED)

    def cancel(self) -> None:
        self._move({self.Status.REQUESTED}, self.Status.CANCELLED)

    def receive(self, resaleable: dict[int, bool]) -> None:
        """APPROVED → RECEIVED with ``resaleable`` given for every item (keyed by return item id)."""
        items = list(self.items.all())
        if {item.pk for item in items} != set(resaleable):
            raise ValidationError({"items": "Set 'resaleable' for every returned item."})
        with transaction.atomic():
            self._move({self.Status.APPROVED}, self.Status.RECEIVED)
            for item in items:
                item.resaleable = resaleable[item.pk]
                item.save(update_fields=["resaleable"])

    def default_refund_amount(self) -> Decimal:
        total = sum((item.order_item.unit_price * item.quantity for item in self.items.select_related("order_item")), Decimal("0"))
        return min(total.quantize(CENT), self.order.refundable_amount())

    def start_refund(self, admin: User, amount: Decimal | None) -> "OrderRefund":
        """RECEIVED: create the approved ``OrderRefund(RETURN)``; the request completes when that refund does.

        The amount is capped by what other open refunds of the order have not already committed.
        """
        from commerce.models import OrderRefund

        with transaction.atomic():
            self._lock()
            if self.status != self.Status.RECEIVED or self.order_refund_id is not None:
                raise InvalidTransition("Only received returns without a refund can be completed.")
            self.refund_amount = self.default_refund_amount() if amount is None else amount
            if not 0 < self.refund_amount <= self.order.refundable_amount():
                raise ValidationError({"refund_amount": "The refund amount exceeds what is left to refund."})
            refund = OrderRefund.objects.create(
                order=self.order, amount=self.refund_amount, reason=OrderRefund.Reason.RETURN, requested_by=self.requested_by
            )
            refund.approve(admin)
            self.order_refund = refund
            self.save(update_fields=["refund_amount", "order_refund", "updated_at"])
        return refund

    def apply_completed_refund(self, order: "Order", completed_at: datetime) -> None:
        """Called by ``OrderRefund.complete`` (order and transaction held): restock and count returned items."""
        from catalog.models import ProductVariant
        from commerce.models import Order

        items = list(self.items.select_related("order_item").order_by("order_item__variant_id"))
        variant_ids = [item.order_item.variant_id for item in items if item.resaleable and item.order_item.variant_id]
        list(ProductVariant.objects.select_for_update().filter(pk__in=variant_ids).order_by("pk"))
        for item in items:
            order_item = item.order_item
            order_item.returned_quantity = F("returned_quantity") + item.quantity
            update_fields = ["returned_quantity"]
            if item.resaleable and order_item.variant_id:
                ProductVariant.objects.filter(pk=order_item.variant_id).update(
                    stock_quantity=F("stock_quantity") + item.quantity
                )
                order_item.restocked_at = completed_at
                update_fields.append("restocked_at")
            order_item.save(update_fields=update_fields)
        self.status = self.Status.COMPLETED
        self.save(update_fields=["status", "updated_at"])
        if not order.items.filter(returned_quantity__lt=F("quantity")).exists():
            order.transition_status(Order.Status.RETURNED)
