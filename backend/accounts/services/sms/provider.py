from django.conf import settings
from django.utils.module_loading import import_string

from accounts.services.sms.interface import SmsSender


def get_sms_sender() -> SmsSender:
    """The active SMS provider, selected by ``settings.SMS_SENDER`` (dotted class path)."""
    return import_string(settings.SMS_SENDER)()
