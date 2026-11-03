import hashlib
import hmac
from typing import TYPE_CHECKING
from urllib.parse import urlencode

from django.conf import settings

if TYPE_CHECKING:
    from rest_framework.request import Request

    from commerce.models import Order, OrderRefund


class SandboxPaymentGateway:
    """Test gateway: callbacks are signed with ``PAYMENT_GATEWAY_SECRET`` (HMAC-SHA256 of the raw body in the
    ``X-Gateway-Signature`` header) and refunds succeed immediately. Replace through ``settings.PAYMENT_GATEWAY``.
    """

    name = "sandbox"

    def payment_url(self, order: "Order") -> str:
        query = urlencode({"order": order.order_number, "amount": str(order.payable_total)})
        return f"{settings.PAYMENT_GATEWAY_URL}?{query}"

    def verify_callback(self, request: "Request") -> bool:
        secret = settings.PAYMENT_GATEWAY_SECRET
        signature = request.headers.get("X-Gateway-Signature", "")
        expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
        return bool(secret) and hmac.compare_digest(signature, expected)

    def refund(self, refund: "OrderRefund") -> str:
        return f"sandbox-refund-{refund.pk}"
