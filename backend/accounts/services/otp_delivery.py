import logging

from django.core.exceptions import ValidationError
from django.db import transaction

from accounts.models import OTPCode
from accounts.services.sms.provider import get_sms_sender
from accounts.services.sms.templates import SmsTemplate

logger = logging.getLogger(__name__)

TEMPLATE_OF_PURPOSE = {
    OTPCode.Purpose.LOGIN: SmsTemplate.LOGIN_CODE,
    OTPCode.Purpose.RESET_PASSWORD: SmsTemplate.PASSWORD_RESET_CODE,
    OTPCode.Purpose.MOBILE_CHANGE_OLD: SmsTemplate.MOBILE_CHANGE_CODE,
    OTPCode.Purpose.MOBILE_CHANGE_NEW: SmsTemplate.MOBILE_CHANGE_CODE,
}


class SmsDeliveryFailed(Exception):
    """The provider did not accept the code (mapped to 502); the code was not stored, so the customer can retry."""


def send_code(mobile: str, purpose: str) -> None:
    """Issue a one-time code (``OTPCode.issue`` enforces the resend window) and text it.

    The code row is rolled back when sending fails, so a failed SMS does not start the resend window.
    """
    try:
        with transaction.atomic():
            code = OTPCode.issue(mobile, purpose)
            get_sms_sender().send_template(mobile, TEMPLATE_OF_PURPOSE[purpose], [code])
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Sending a {purpose} code failed: {str(e)}", exc_info=True)
        raise SmsDeliveryFailed() from e
