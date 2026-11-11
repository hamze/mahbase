import logging

from celery import shared_task
from django.utils import timezone

from accounts.services.sms.provider import get_sms_sender
from accounts.services.sms.templates import SmsTemplate
from commerce.models import Order
from commerce.services.refunds import process_refund

logger = logging.getLogger(__name__)


@shared_task
def release_expired_reservations() -> int:
    """Celery beat (``CELERY_BEAT_SCHEDULE``): release every RESERVED order past ``reservation_expires_at``."""
    expired = list(Order.objects.filter(
        stock_reservation_status=Order.ReservationStatus.RESERVED, reservation_expires_at__lte=timezone.now()
    ).values_list("pk", flat=True))
    released = sum(Order.expire_reservation(order_id) for order_id in expired)
    if released:
        logger.info(f"Released {released} expired order reservations")
    return released


@shared_task
def send_sms_task(mobile: str, template: str, tokens: list[str]) -> None:
    """Notification SMS (``Notification.notify``); a failure is logged and not retried."""
    try:
        get_sms_sender().send_template(mobile, SmsTemplate(template), tokens)
    except Exception as e:
        logger.error(f"Notification SMS {template} failed: {str(e)}", exc_info=True)


@shared_task
def process_refund_task(refund_id: int) -> None:
    process_refund(refund_id)
