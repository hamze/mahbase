from decimal import Decimal
from typing import TYPE_CHECKING, NamedTuple, Protocol

if TYPE_CHECKING:
    from commerce.models import Order, OrderRefund


class PaymentRequest(NamedTuple):
    """The bank's answer to a payment request: its token for this attempt and where to send the customer."""

    authority: str
    redirect_url: str


class PaymentVerification(NamedTuple):
    """The bank's server-side verification of a returned payment."""

    succeeded: bool
    reference_id: str | None
    amount: Decimal
    card_pan: str


class PaymentGateway(Protocol):
    """Contract for an Iranian bank gateway (request → redirect → return to ``callback_url`` → verify)."""

    name: str

    def request_payment(self, order: "Order", callback_url: str) -> PaymentRequest:
        """Register a payment of ``order.payable_total``; raises when the bank refuses or is unreachable."""

    def verify(self, authority: str, amount: Decimal) -> PaymentVerification:
        """Confirm with the bank whether the attempt ``authority`` was paid with ``amount``; raises when unreachable."""

    def refund(self, refund: "OrderRefund") -> str:
        """Refund ``refund.amount`` of the order's payment; returns the gateway refund id, raises on failure."""
