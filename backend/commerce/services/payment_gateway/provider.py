from django.conf import settings
from django.utils.module_loading import import_string

from commerce.services.payment_gateway.interface import PaymentGateway


def get_payment_gateway() -> PaymentGateway:
    """The active payment provider, selected by ``settings.PAYMENT_GATEWAY`` (dotted class path)."""
    return import_string(settings.PAYMENT_GATEWAY)()
