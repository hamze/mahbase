from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from rest_framework.request import Request

    from commerce.models import Order, OrderRefund


class PaymentGateway(Protocol):
    """Contract for the bank/payment provider."""

    name: str

    def payment_url(self, order: "Order") -> str:
        """Where the customer is redirected to pay ``order.payable_total``."""

    def verify_callback(self, request: "Request") -> bool:
        """Whether a callback request really comes from the gateway."""

    def refund(self, refund: "OrderRefund") -> str:
        """Refund ``refund.amount`` of the order's payment; returns the gateway refund id, raises on failure."""
