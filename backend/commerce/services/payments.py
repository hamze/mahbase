"""Payment callback (``POST /api/payments/callback/``): idempotent, order locked first, then variants ascending."""

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from commerce.models import Order, OrderRefund, PaymentTransaction

logger = logging.getLogger(__name__)


class DuplicateGatewayTransaction(Exception):
    """The callback idempotency key or gateway transaction id is already recorded for a different order (409)."""


def handle_callback(
    *,
    order_number: str,
    idempotency_key: str,
    gateway: str,
    gateway_transaction_id: str | None,
    amount: Decimal,
    succeeded: bool,
    method: str,
    raw_response: dict,
) -> PaymentTransaction:
    """Apply one gateway result exactly once and return the transaction that answers it.

    Reservation RESERVED → CONVERTED on success; a payment for a RELEASED order or for a ``stock_invalidated`` order
    is recorded, added to ``paid_total`` as REFUNDED, refunded through an approved ``OrderRefund`` and never applied
    to stock. A held order paid with an amount other than ``payable_total`` is rejected and refunded like a
    ``stock_invalidated`` one. Any later successful payment of an order that already has one is recorded as
    DUPLICATE_REJECTED.
    """
    refund = None
    with transaction.atomic():
        order = Order.objects.select_for_update().get(order_number=order_number)
        if existing := PaymentTransaction.objects.filter(idempotency_key=idempotency_key).first():
            if existing.order_id == order.pk:
                return existing
            logger.error(
                f"Callback idempotency key {idempotency_key} for order {order_number} is already recorded for order "
                f"{existing.order.order_number}; callback rejected"
            )
            raise DuplicateGatewayTransaction()
        if gateway_transaction_id:
            duplicate = PaymentTransaction.objects.filter(
                gateway=gateway, gateway_transaction_id=gateway_transaction_id
            ).first()
            if duplicate is not None and duplicate.order_id == order.pk:
                return duplicate
            if duplicate is not None:
                logger.error(
                    f"Gateway transaction {gateway}:{gateway_transaction_id} for order {order_number} is already "
                    f"recorded for order {duplicate.order.order_number}; callback rejected"
                )
                raise DuplicateGatewayTransaction()

        now = timezone.now()

        def record(status: str) -> PaymentTransaction:
            return PaymentTransaction.objects.create(
                order=order,
                idempotency_key=idempotency_key,
                gateway=gateway,
                gateway_transaction_id=gateway_transaction_id,
                amount=amount,
                method=method,
                status=status,
                paid_at=now if succeeded else None,
                raw_response=raw_response,
            )

        reservation = order.stock_reservation_status
        if not succeeded:
            if reservation == Order.ReservationStatus.RESERVED:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save(update_fields=["payment_status", "updated_at"])
            return record(PaymentTransaction.Status.FAILED)

        if reservation == Order.ReservationStatus.CONVERTED or (
            reservation == Order.ReservationStatus.RELEASED and order.paid_total > 0
        ):
            # The order's payment is already applied or refunded: keep evidence of the second payment for
            # reconciliation instead of refunding it again.
            logger.error(f"Second successful payment {gateway_transaction_id} for paid order {order_number}")
            return record(PaymentTransaction.Status.DUPLICATE_REJECTED)

        if reservation == Order.ReservationStatus.RELEASED:
            # Stock and the cancelled order stay as they are; the payment and its refund show on the order's totals.
            transaction_row = record(PaymentTransaction.Status.REJECTED_AFTER_RELEASE)
            refund = _approved_refund(order, amount, OrderRefund.Reason.PAYMENT_AFTER_RELEASE)
            order.paid_total = amount
            order.paid_at = now
            order.payment_status = Order.PaymentStatus.REFUNDED
            order.save(update_fields=["paid_total", "paid_at", "payment_status", "updated_at"])
        elif order.stock_invalidated or amount != order.payable_total:
            if order.stock_invalidated:
                refund_reason, cancellation_reason = (
                    OrderRefund.Reason.STOCK_INVALIDATED, Order.CancellationReason.STOCK_INVALIDATED
                )
            else:
                logger.error(
                    f"Payment {gateway_transaction_id} for order {order_number} captured {amount}, expected "
                    f"{order.payable_total}; payment refunded"
                )
                refund_reason, cancellation_reason = (
                    OrderRefund.Reason.PAYMENT_AMOUNT_MISMATCH, Order.CancellationReason.PAYMENT_AMOUNT_MISMATCH
                )
            transaction_row = record(PaymentTransaction.Status.SUCCESS_BUT_REJECTED)
            refund = _approved_refund(order, amount, refund_reason)
            order.paid_total = amount
            order.paid_at = now
            order.payment_status = Order.PaymentStatus.REFUNDED
            order.release_reservation()
            order.cancel(cancellation_reason)
            order.save()
        else:
            # Accepted whenever the reservation is still held, even after reservation_expires_at.
            if now > order.reservation_expires_at:
                logger.info(f"metric=late_payment_accepted order={order_number}")
            order.convert_reservation()
            transaction_row = record(PaymentTransaction.Status.SUCCESS)
            order.paid_total = amount
            order.paid_at = now
            order.payment_status = Order.PaymentStatus.PAID
            order.transition_status(Order.Status.IN_PREPARATION)
            order.save()

        if refund is not None:
            # Gateway refund only after this transaction committed; callback retries hit the idempotency checks above.
            from commerce.tasks import process_refund_task

            refund_id = refund.pk
            transaction.on_commit(lambda: process_refund_task.delay(refund_id))
    return transaction_row


def _approved_refund(order: Order, amount: Decimal, reason: str) -> OrderRefund:
    return OrderRefund.objects.create(
        order=order, amount=amount, reason=reason, status=OrderRefund.Status.APPROVED, approved_at=timezone.now()
    )
