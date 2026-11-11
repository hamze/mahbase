import secrets
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import F, Q
from django.utils import timezone

from accounts.services.sms.templates import SmsTemplate
from catalog.models.product_variant import PRICE

if TYPE_CHECKING:
    from commerce.models import OrderRefund

ZERO = Decimal("0")


# Order status → (notification title, SMS template). Reaching IN_PREPARATION means the payment was accepted.
STATUS_NOTIFICATIONS = {
    "IN_PREPARATION": ("پرداخت سفارش شما تأیید شد", SmsTemplate.ORDER_PAID),
    "SHIPPED": ("سفارش شما ارسال شد", SmsTemplate.ORDER_SHIPPED),
    "DELIVERED": ("سفارش شما تحویل شد", SmsTemplate.ORDER_DELIVERED),
}


class InvalidTransition(Exception):
    """A status change that the order state machine does not allow (mapped to 409 by the views)."""


class Order(models.Model):
    """Customer order. Stock is held through ``stock_reservation_status`` and ``ProductVariant.reserved_quantity``.

    ``order_status`` and ``payment_status`` are independent. A paid order is cancelled or returned only through an
    ``OrderRefund`` / ``ReturnRequest`` completion, never by a plain status change.
    """

    class Status(models.TextChoices):
        PENDING_PAYMENT = "PENDING_PAYMENT"
        IN_PREPARATION = "IN_PREPARATION"
        READY_TO_SHIP = "READY_TO_SHIP"
        SHIPPED = "SHIPPED"
        DELIVERED = "DELIVERED"
        CANCELLED = "CANCELLED"
        RETURNED = "RETURNED"

    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID"
        PENDING = "PENDING"
        PAID = "PAID"
        FAILED = "FAILED"
        PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"
        REFUNDED = "REFUNDED"

    class ReservationStatus(models.TextChoices):
        RESERVED = "RESERVED"
        CONVERTED = "CONVERTED"
        RELEASED = "RELEASED"

    class CancellationReason(models.TextChoices):
        RESERVATION_EXPIRED = "RESERVATION_EXPIRED"
        ADMIN_UNPAID_CANCEL = "ADMIN_UNPAID_CANCEL"
        ADMIN_CANCEL_BEFORE_SHIP = "ADMIN_CANCEL_BEFORE_SHIP"
        STOCK_INVALIDATED = "STOCK_INVALIDATED"
        PAYMENT_AMOUNT_MISMATCH = "PAYMENT_AMOUNT_MISMATCH"

    # Every allowed order_status change. CANCELLED after payment and RETURNED are reached only from the refund and
    # return workflows; SHIPPED → CANCELLED is forbidden (deliver first, then return).
    TRANSITIONS = {
        Status.PENDING_PAYMENT: {Status.IN_PREPARATION, Status.CANCELLED},
        Status.IN_PREPARATION: {Status.READY_TO_SHIP, Status.CANCELLED},
        Status.READY_TO_SHIP: {Status.SHIPPED, Status.CANCELLED},
        Status.SHIPPED: {Status.DELIVERED},
        Status.DELIVERED: {Status.RETURNED},
    }
    # Changes an admin may make with the plain status endpoint (``admin.orders.status``).
    MANUAL_TRANSITIONS = {
        Status.IN_PREPARATION: {Status.READY_TO_SHIP},
        Status.READY_TO_SHIP: {Status.SHIPPED},
        Status.SHIPPED: {Status.DELIVERED},
    }

    order_number = models.CharField(max_length=20, unique=True)
    idempotency_key = models.CharField(max_length=64)
    # sha256 of the confirmation request body: a repeated key with a different body is rejected, not answered.
    request_fingerprint = models.CharField(max_length=64)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    customer_tier_snapshot = models.CharField(max_length=10)
    order_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    subtotal_products = models.DecimalField(**PRICE, default=ZERO)
    product_discount_total = models.DecimalField(**PRICE, default=ZERO)
    discount_code = models.ForeignKey(
        "commerce.DiscountCode", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders"
    )
    discount_code_snapshot = models.CharField(max_length=50, blank=True)
    discount_amount = models.DecimalField(**PRICE, default=ZERO)
    coupon_consumed = models.BooleanField(default=False)
    shipping_method_name_snapshot = models.CharField(max_length=150, blank=True)
    shipping_cost = models.DecimalField(**PRICE, default=ZERO)
    shipping_discount_amount = models.DecimalField(**PRICE, default=ZERO)
    other_costs = models.DecimalField(**PRICE, default=ZERO)
    # Snapshots of StoreSettings.packaging_fee and the tax computed at confirmation.
    packaging_fee = models.DecimalField(**PRICE, default=ZERO)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    tax_amount = models.DecimalField(**PRICE, default=ZERO)
    payable_total = models.DecimalField(**PRICE, default=ZERO)
    paid_total = models.DecimalField(**PRICE, default=ZERO)
    refunded_total = models.DecimalField(**PRICE, default=ZERO)
    reservation_expires_at = models.DateTimeField(db_index=True)
    stock_reservation_status = models.CharField(
        max_length=10, choices=ReservationStatus.choices, default=ReservationStatus.RESERVED
    )
    # Set when an admin confirmed stock below the reserved quantity; a later payment is refunded, not accepted.
    stock_invalidated = models.BooleanField(default=False)
    placed_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=30, choices=CancellationReason.choices, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "idempotency_key"], name="uniq_order_idempotency_key"),
            models.CheckConstraint(
                name="order_cancelled_not_paid", condition=~Q(order_status="CANCELLED", payment_status="PAID")
            ),
            models.CheckConstraint(name="order_payable_non_negative", condition=Q(payable_total__gte=0)),
            models.CheckConstraint(name="order_refunded_lte_paid", condition=Q(refunded_total__lte=F("paid_total"))),
        ]
        permissions = [
            ("admin_orders_view_all", "Can view all orders"),
            ("admin_orders_create", "Can create orders"),
            ("admin_orders_edit", "Can edit orders"),
            ("admin_orders_status", "Can change order status"),
            ("admin_orders_cancel", "Can cancel orders"),
        ]

    def __str__(self) -> str:
        return self.order_number

    def set_totals(self, packaging_fee: Decimal, tax_percentage: Decimal) -> None:
        """``payable_total`` from the already set product, discount and shipping amounts.

        Tax applies to products after discounts plus packaging and shipping after its discount.
        """
        taxable = (
            self.subtotal_products - self.discount_amount + self.shipping_cost - self.shipping_discount_amount
            + packaging_fee + self.other_costs
        )
        self.packaging_fee = packaging_fee
        self.tax_percentage = tax_percentage
        self.tax_amount = (taxable * tax_percentage / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        self.payable_total = taxable + self.tax_amount

    @staticmethod
    def new_order_number() -> str:
        return f"{timezone.localdate():%y%m%d}{secrets.randbelow(10 ** 8):08d}"

    @staticmethod
    def reservation_deadline() -> datetime:
        return timezone.now() + timedelta(minutes=settings.ORDER_RESERVATION_MINUTES)

    @classmethod
    def lock_reserved_for_variant(cls, variant_id: int) -> list["Order"]:
        """Lock (ascending id) the orders currently holding a reservation on a variant."""
        from commerce.models import OrderItem

        order_ids = OrderItem.objects.filter(variant_id=variant_id).values("order_id")
        return list(
            cls.objects.select_for_update()
            .filter(stock_reservation_status=cls.ReservationStatus.RESERVED, pk__in=order_ids)
            .order_by("pk")
        )

    @classmethod
    def reserved_on_variant(cls, variant_id: int) -> list[dict]:
        """``[{order_number, quantity}]`` of RESERVED orders holding stock of a variant (variant locked by caller)."""
        rows = (
            cls.objects.filter(stock_reservation_status=cls.ReservationStatus.RESERVED, items__variant_id=variant_id)
            .values("order_number")
            .annotate(quantity=models.Sum("items__quantity"))
            .order_by("order_number")
        )
        return [{"order_number": row["order_number"], "quantity": row["quantity"]} for row in rows]

    @classmethod
    def invalidate_reserved_on_variant(cls, variant_id: int) -> list[dict]:
        """Mark every RESERVED order on the variant ``stock_invalidated`` (its payment will be refunded)."""
        affected = cls.reserved_on_variant(variant_id)
        cls.objects.filter(order_number__in=[row["order_number"] for row in affected]).update(stock_invalidated=True)
        return affected

    def transition_status(self, new_status: str, *, manual: bool = False) -> None:
        """Validate and set ``order_status`` (caller saves); raises ``InvalidTransition``."""
        allowed = (self.MANUAL_TRANSITIONS if manual else self.TRANSITIONS).get(self.order_status, set())
        if new_status not in allowed:
            raise InvalidTransition(f"وضعیت سفارش از {self.order_status} به {new_status} قابل تغییر نیست.")
        self.order_status = new_status
        if new_status in STATUS_NOTIFICATIONS:
            self.notify(*STATUS_NOTIFICATIONS[new_status])

    def notify(self, title: str, template: str) -> None:
        """In-app notification to the customer (plus SMS when enabled) about this order."""
        from commerce.models import Notification

        Notification.notify(
            self.user, Notification.Type.ORDER, title, f"سفارش {self.order_number}",
            related=("order", self.pk), sms=(template, [self.order_number]),
        )

    def cancel(self, reason: str) -> None:
        """Move to CANCELLED (caller saves)."""
        self.transition_status(self.Status.CANCELLED)
        self.cancelled_at = timezone.now()
        self.cancellation_reason = reason

    def release_reservation(self) -> None:
        """RESERVED → RELEASED: give back reserved stock (variants locked ascending; order already locked)."""
        self._apply_reserved_items(convert=False)
        self.stock_reservation_status = self.ReservationStatus.RELEASED

    def convert_reservation(self) -> None:
        """RESERVED → CONVERTED: reserved stock leaves the warehouse (variants locked ascending)."""
        self._apply_reserved_items(convert=True)
        self.stock_reservation_status = self.ReservationStatus.CONVERTED

    def _apply_reserved_items(self, *, convert: bool) -> None:
        from catalog.models import ProductVariant

        if self.stock_reservation_status != self.ReservationStatus.RESERVED:
            raise InvalidTransition(f"وضعیت رزرو موجودی هم‌اکنون {self.stock_reservation_status} است.")
        quantities = {}
        for item in self.items.exclude(variant=None):
            quantities[item.variant_id] = quantities.get(item.variant_id, ZERO) + item.quantity
        variant_ids = sorted(quantities)
        list(ProductVariant.objects.select_for_update().filter(pk__in=variant_ids).order_by("pk"))
        for variant_id in variant_ids:
            changes = {"reserved_quantity": F("reserved_quantity") - quantities[variant_id]}
            if convert:
                changes["stock_quantity"] = F("stock_quantity") - quantities[variant_id]
            ProductVariant.objects.filter(pk=variant_id).update(**changes)

    def release_coupon(self) -> None:
        """Give the discount code use back (caller saves the order)."""
        from commerce.models import DiscountCode

        if not self.coupon_consumed:
            return
        if self.discount_code_id is not None:
            DiscountCode.objects.filter(pk=self.discount_code_id).update(used_count=F("used_count") - 1)
        self.coupon_consumed = False

    def cancel_unpaid_by_admin(self) -> None:
        """Admin cancel of an unpaid order; refused while the customer is at the bank (a success would be refunded)."""
        if self.payment_status == self.PaymentStatus.PENDING:
            raise InvalidTransition("Payment is in progress; wait for the bank result or the reservation expiry.")
        self.cancel_unpaid(self.CancellationReason.ADMIN_UNPAID_CANCEL)

    def cancel_unpaid(self, reason: str) -> None:
        """Expiry / admin unpaid cancel (order locked by caller): release stock and the code use, then cancel."""
        self.release_reservation()
        self.cancel(reason)
        self.release_coupon()
        self.save()

    @classmethod
    def expire_reservation(cls, order_id: int) -> bool:
        """Release one expired reservation; no-op when payment already converted/released it. Returns True if released.

        Locks the order first and checks the status inside the lock (as the payment callback does), so expiry and
        payment never both apply. FAILED payments are released too: the customer can only retry while stock is held.
        """
        with transaction.atomic():
            order = cls.objects.select_for_update().get(pk=order_id)
            if order.stock_reservation_status != cls.ReservationStatus.RESERVED or order.payment_status not in (
                cls.PaymentStatus.UNPAID, cls.PaymentStatus.PENDING, cls.PaymentStatus.FAILED
            ):
                return False
            order.cancel_unpaid(cls.CancellationReason.RESERVATION_EXPIRED)
        return True

    def refundable_amount(self) -> Decimal:
        """Paid money not yet refunded or committed to an open refund (order locked by caller)."""
        from commerce.models import OrderRefund

        committed = (
            self.refunds.exclude(status__in=(OrderRefund.Status.COMPLETED, OrderRefund.Status.REJECTED))
            .aggregate(total=models.Sum("amount"))["total"]
            or ZERO
        )
        return self.paid_total - self.refunded_total - committed

    def request_cancellation_refund(self, requested_by: User, *, approved_by: User | None = None) -> "OrderRefund":
        """Refund the whole remaining payment of a paid order that has not shipped (order locked by caller).

        The order is cancelled and restocked only when the refund completes, so it is refused while any other refund
        (e.g. a return refund that restocks its own items) is still open.
        """
        from commerce.models import OrderRefund

        if self.payment_status not in (self.PaymentStatus.PAID, self.PaymentStatus.PARTIALLY_REFUNDED) or (
            self.order_status not in (self.Status.IN_PREPARATION, self.Status.READY_TO_SHIP)
        ):
            raise InvalidTransition("فقط سفارش‌های پرداخت‌شده‌ای که ارسال نشده‌اند با بازگشت وجه لغو می‌شوند.")
        if self.refunds.exclude(status__in=(OrderRefund.Status.COMPLETED, OrderRefund.Status.REJECTED)).exists():
            raise InvalidTransition("This order has an open refund; finish or reject it before cancelling.")
        amount = self.refundable_amount()
        if amount <= 0:
            raise InvalidTransition("مبلغی برای بازگشت وجه در این سفارش باقی نمانده است.")
        refund = OrderRefund.objects.create(
            order=self,
            amount=amount,
            reason=OrderRefund.Reason.ADMIN_CANCEL_BEFORE_SHIP,
            requested_by=requested_by,
        )
        if approved_by is not None:
            refund.approve(approved_by)
        return refund
