from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import F, Q
from django.utils import timezone

from catalog.models.product_variant import PRICE
from commerce.models.order import InvalidTransition


class OrderRefund(models.Model):
    """Money back to the customer. Approval and the gateway refund are separate steps; effects apply on COMPLETED.

    REQUESTED → APPROVED → PROCESSING → COMPLETED | FAILED (FAILED may be processed again); REQUESTED → REJECTED.
    """

    class Reason(models.TextChoices):
        ADMIN_CANCEL_BEFORE_SHIP = "ADMIN_CANCEL_BEFORE_SHIP"
        RETURN = "RETURN"
        PAYMENT_AFTER_RELEASE = "PAYMENT_AFTER_RELEASE"
        STOCK_INVALIDATED = "STOCK_INVALIDATED"
        PAYMENT_AMOUNT_MISMATCH = "PAYMENT_AMOUNT_MISMATCH"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED"
        APPROVED = "APPROVED"
        PROCESSING = "PROCESSING"
        COMPLETED = "COMPLETED"
        FAILED = "FAILED"
        REJECTED = "REJECTED"

    order = models.ForeignKey("commerce.Order", on_delete=models.PROTECT, related_name="refunds")
    amount = models.DecimalField(**PRICE)
    reason = models.CharField(max_length=30, choices=Reason.choices)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.REQUESTED)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    gateway_refund_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(name="refund_amount_positive", condition=Q(amount__gt=0)),
            # Cancellation-type refunds happen at most once per order (returns and late payments may repeat).
            models.UniqueConstraint(
                fields=["order"],
                condition=Q(reason__in=["ADMIN_CANCEL_BEFORE_SHIP", "STOCK_INVALIDATED", "PAYMENT_AMOUNT_MISMATCH"])
                & ~Q(status="REJECTED"),
                name="uniq_order_cancellation_refund",
            ),
        ]
        permissions = [
            ("admin_refunds_approve", "Can approve or reject refunds"),
            ("admin_refunds_complete", "Can process refunds through the gateway"),
        ]

    def _move(self, allowed_from: set[str], new_status: str) -> None:
        if self.status not in allowed_from:
            raise InvalidTransition(f"Refund cannot change from {self.status} to {new_status}.")
        self.status = new_status

    def approve(self, admin: User) -> None:
        self._move({self.Status.REQUESTED}, self.Status.APPROVED)
        self.approved_by = admin
        self.approved_at = timezone.now()
        self.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    def reject(self) -> None:
        self._move({self.Status.REQUESTED}, self.Status.REJECTED)
        self.save(update_fields=["status", "updated_at"])

    def start_processing(self) -> None:
        self._move({self.Status.APPROVED, self.Status.FAILED}, self.Status.PROCESSING)
        self.save(update_fields=["status", "updated_at"])

    def fail(self) -> None:
        self._move({self.Status.PROCESSING}, self.Status.FAILED)
        self.save(update_fields=["status", "updated_at"])

    def complete(self, gateway_refund_id: str) -> None:
        """PROCESSING → COMPLETED and apply the effects on the order, stock and discount code in one transaction."""
        from catalog.models import ProductVariant
        from commerce.models import Order

        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.order_id)
            self._move({self.Status.PROCESSING}, self.Status.COMPLETED)
            self.gateway_refund_id = gateway_refund_id
            self.completed_at = timezone.now()
            self.save(update_fields=["status", "gateway_refund_id", "completed_at", "updated_at"])

            order.refunded_total += self.amount
            fully_refunded = order.refunded_total >= order.paid_total
            order.payment_status = (
                Order.PaymentStatus.REFUNDED if fully_refunded else Order.PaymentStatus.PARTIALLY_REFUNDED
            )
            if self.reason == self.Reason.ADMIN_CANCEL_BEFORE_SHIP:
                order.cancel(Order.CancellationReason.ADMIN_CANCEL_BEFORE_SHIP)
                # Goods never left the warehouse: put the converted stock back.
                items = list(order.items.exclude(variant=None).order_by("variant_id"))
                list(ProductVariant.objects.select_for_update().filter(pk__in=[i.variant_id for i in items]).order_by("pk"))
                for item in items:
                    ProductVariant.objects.filter(pk=item.variant_id).update(
                        stock_quantity=F("stock_quantity") + item.quantity
                    )
                order.items.update(restocked_at=self.completed_at)
            elif self.reason == self.Reason.RETURN:
                self.return_request.apply_completed_refund(order, self.completed_at)
            if fully_refunded and order.discount_code_id and order.discount_code.release_on_refund:
                order.release_coupon()
            order.save()
