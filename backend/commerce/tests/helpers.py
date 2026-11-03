import hashlib
import hmac
import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import Client

from accounts.models import UserProfile
from catalog.models import Product, ProductVariant
from catalog.tests.helpers import CatalogFixture
from commerce.models import Address, Cart, City, Province, ShippingMethod

GATEWAY_SECRET = "test-secret"


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


def post_callback(client: Client, payload: dict) -> object:
    body = json.dumps(payload)
    signature = hmac.new(GATEWAY_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return client.generic(
        "POST", "/api/payments/callback/", body, content_type="application/json", HTTP_X_GATEWAY_SIGNATURE=signature
    )
