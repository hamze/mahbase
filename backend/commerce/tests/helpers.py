from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth.models import User

from accounts.models import UserProfile
from catalog.models import Product, ProductVariant
from catalog.tests.helpers import CatalogFixture
from commerce.models import Address, Cart, City, Order, Province, ShippingMethod
from commerce.services.payment_gateway.interface import PaymentRequest, PaymentVerification
from commerce.services.payments import DuplicateGatewayTransaction, handle_callback

FAKE_GATEWAY = "commerce.tests.helpers.FakeBankGateway"


class ShopFixture:
    """A published product with variants SHIRT-S/SHIRT-M (stock 5, price 100), a city, a shipping method."""

    def __init__(self) -> None:
        catalog = CatalogFixture()
        self.product: Product = catalog.create_product()
        self.product.is_published = True
        self.product.save()
        self.product.variants.update(base_price=Decimal("100"))
        self.variant = ProductVariant.objects.get(sku="SHIRT-S")
        self.province = Province.objects.create(name="Tehran")
        self.city = City.objects.create(province=self.province, name="Tehran")
        self.shipping = ShippingMethod.objects.create(name="Post", price=Decimal("30"))

    def customer(self, mobile: str, quantity: str = "2") -> tuple[User, Address]:
        user = UserProfile.create_customer(mobile, UserProfile.CreatedSource.SELF_SIGNUP)
        address = Address.objects.create(
            user=user, title="Home", receiver_name="R", receiver_mobile=mobile, province=self.province,
            city=self.city, address_line="Street 1", postal_code="1234567890", is_default=True,
        )
        Cart.active_for(user).items.create(variant=self.variant, quantity=Decimal(quantity))
        return user, address

    def order_payload(self, address: Address, **extra: object) -> dict:
        return {"address": address.pk, "shipping_method": self.shipping.pk, **extra}


class FakeBankGateway:
    """Test bank: every request gets authority ``AUTH-<order number>-<n>``; ``verified`` decides verification."""

    name = "fake"
    verified: dict[str, PaymentVerification] = {}
    requests = 0

    def request_payment(self, order: Order, callback_url: str) -> PaymentRequest:
        FakeBankGateway.requests += 1
        authority = f"AUTH-{order.order_number}-{FakeBankGateway.requests}"
        return PaymentRequest(authority, f"https://bank.test/pay/{authority}")

    def verify(self, authority: str, amount: Decimal) -> PaymentVerification:
        return self.verified.get(authority, PaymentVerification(False, None, amount, ""))

    def refund(self, refund: object) -> str:
        return f"fake-refund-{refund.pk}"


@dataclass
class CallbackResult:
    status_code: int
    data: dict

    def json(self) -> dict:
        return self.data


def post_callback(payload: dict) -> CallbackResult:
    """Apply a bank result through ``handle_callback`` (the payment-result rules), as the return view does."""
    try:
        payment = handle_callback(
            order_number=payload["order_number"], idempotency_key=payload["idempotency_key"], gateway="fake",
            gateway_transaction_id=payload.get("gateway_transaction_id"), amount=Decimal(payload["amount"]),
            succeeded=payload["status"] == "SUCCESS", method="online", raw_response={},
        )
    except DuplicateGatewayTransaction:
        return CallbackResult(409, {})
    return CallbackResult(200, {"result": payment.status})
