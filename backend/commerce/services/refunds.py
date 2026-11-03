import logging

from django.db import transaction

from commerce.models import OrderRefund
from commerce.services.payment_gateway.provider import get_payment_gateway

logger = logging.getLogger(__name__)


def process_refund(refund_id: int) -> OrderRefund:
    """Send an APPROVED (or previously FAILED) refund to the gateway; COMPLETED applies its effects.

    The refund row is moved to PROCESSING under a lock first, so concurrent or repeated calls never send it twice.
    """
    with transaction.atomic():
        refund = OrderRefund.objects.select_for_update().get(pk=refund_id)
        if refund.status not in (OrderRefund.Status.APPROVED, OrderRefund.Status.FAILED):
            return refund
        refund.start_processing()
    try:
        gateway_refund_id = get_payment_gateway().refund(refund)
    except Exception as e:
        logger.error(f"Gateway refund failed for refund {refund.pk}: {str(e)}", exc_info=True)
        refund.fail()
        return refund
    refund.complete(gateway_refund_id)
    return refund
