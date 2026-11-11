from decimal import Decimal
from typing import TYPE_CHECKING

import requests
from django.conf import settings

from commerce.services.payment_gateway.interface import PaymentRequest, PaymentVerification

if TYPE_CHECKING:
    from commerce.models import Order, OrderRefund

# Mock bank result codes (Zarinpal style): 100 done, 101 already verified.
CODE_OK = 100
CODE_ALREADY_VERIFIED = 101


class MockBankError(Exception):
    """The mock bank refused a request."""


class MockBankGateway:
    """Client of the mock bank service (``payment-mock/``). The backend calls ``PAYMENT_MOCK_API_URL`` (container
    network); the customer is sent to ``PAYMENT_MOCK_PUBLIC_URL`` (browser).
    """

    name = "mock"

    def _call(self, path: str, payload: dict) -> dict:
        response = requests.post(
            f"{settings.PAYMENT_MOCK_API_URL}{path}",
            json={"merchant_id": settings.PAYMENT_MERCHANT_ID, **payload},
            timeout=settings.PAYMENT_GATEWAY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def request_payment(self, order: "Order", callback_url: str) -> PaymentRequest:
        data = self._call("/api/v1/request", {
            "amount": str(order.payable_total), "callback_url": callback_url, "order_id": order.order_number,
            "description": f"Order {order.order_number}",
        })
        if data.get("code") != CODE_OK:
            raise MockBankError(f"Payment request refused with code {data.get('code')}")
        authority = data["authority"]
        return PaymentRequest(authority, f"{settings.PAYMENT_MOCK_PUBLIC_URL}/pay/{authority}")

    def verify(self, authority: str, amount: Decimal) -> PaymentVerification:
        data = self._call("/api/v1/verify", {"authority": authority, "amount": str(amount)})
        succeeded = data.get("code") in (CODE_OK, CODE_ALREADY_VERIFIED)
        return PaymentVerification(
            succeeded, data.get("ref_id") if succeeded else None, Decimal(str(data.get("amount", amount))),
            data.get("card_pan", ""),
        )

    def refund(self, refund: "OrderRefund") -> str:
        payment = refund.order.payments.filter(gateway=self.name, gateway_transaction_id__isnull=False).first()
        data = self._call("/api/v1/refund", {"ref_id": payment.gateway_transaction_id, "amount": str(refund.amount)})
        if data.get("code") != CODE_OK:
            raise MockBankError(f"Refund refused with code {data.get('code')}")
        return data["refund_id"]
