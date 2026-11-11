import uuid
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import UserProfile
from catalog.models import ProductVariant
from commerce.models import Order, ProductReview, StoreSettings
from commerce.services.payment_gateway.interface import PaymentVerification
from commerce.tests.helpers import FAKE_GATEWAY, FakeBankGateway, ShopFixture


class StorefrontCatalogTests(TestCase):
    def setUp(self) -> None:
        self.shop = ShopFixture()
        ProductVariant.objects.filter(sku="SHIRT-S").update(wholesale_price=Decimal("80"), discount_percentage=10,
                                                            is_discount_active=True)

    def test_every_body_is_a_responses_envelope(self) -> None:
        client = APIClient()
        listed = client.get("/api/shop/products/").json()
        self.assertEqual((listed["state"], listed["message"]), ("success", "success"))
        self.assertIn("results", listed["data"])
        missing = client.get("/api/shop/products/no-such-product/")
        self.assertEqual((missing.status_code, missing.json()["state"]), (404, "not_found"))
        invalid = client.post("/api/auth/otp/verify/", {"mobile": "0912", "code": ""}, format="json")
        self.assertEqual((invalid.status_code, invalid.json()["state"]), (400, "wrong_inputs"))
        self.assertIn("mobile", invalid.json()["data"])
        wrong_code = client.post("/api/auth/otp/verify/", {"mobile": "09120000001", "code": "000000"}, format="json")
        self.assertEqual((wrong_code.status_code, wrong_code.json()["state"]), (400, "invalid_otp"))

    def test_public_product_shows_tier_prices_rating_and_badges_without_stock_or_wholesale_leak(self) -> None:
        user, _ = self.shop.customer("09120000001")
        for mobile, rating in (("09120000002", 5), ("09120000003", 4)):
            reviewer, _ = self.shop.customer(mobile)
            ProductReview.objects.create(product=self.shop.product, user=reviewer, rating=rating, body="ok",
                                         status=ProductReview.Status.APPROVED)
        ProductReview.objects.create(product=self.shop.product, user=user, rating=1, body="x")  # pending: ignored

        data = APIClient().get(f"/api/shop/products/{self.shop.product.slug}/").json()["data"]
        self.assertEqual((data["rating_average"], data["rating_count"]), ("4.5", 2))
        self.assertEqual(data["badges"], ["جدید"])
        small = next(v for v in data["variants"] if v["sku"] == "SHIRT-S")
        self.assertEqual((small["original_price"], small["price"], small["is_available"]), ("100.00", "90.00", True))
        self.assertFalse({"stock_quantity", "reserved_quantity", "wholesale_price", "base_price"} & set(small))

        UserProfile.objects.filter(user=user).update(customer_tier=UserProfile.CustomerTier.WHOLESALE)
        client = APIClient()
        client.force_authenticate(type(user).objects.get(pk=user.pk))
        listed = client.get("/api/shop/products/", {"category": "clothing", "sort": "cheapest"}).json()["data"]["results"]
        self.assertEqual(listed[0]["price"], {"original_price": "80.00", "price": "72.00", "discount_percentage": "10.00"})

        self.shop.product.is_published = False
        self.shop.product.save()
        self.assertEqual(APIClient().get(f"/api/shop/products/{self.shop.product.slug}/").status_code, 404)


@override_settings(PAYMENT_GATEWAY=FAKE_GATEWAY)
class CheckoutAndPaymentTests(TestCase):
    def setUp(self) -> None:
        self.shop = ShopFixture()
        self.user, self.address = self.shop.customer("09120000001")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        StoreSettings.objects.filter(pk=StoreSettings.get_solo().pk).update(
            packaging_fee=Decimal("20"), tax_percentage=Decimal("10")
        )

    def test_quote_and_order_add_packaging_and_tax(self) -> None:
        cart = self.client.get("/api/cart/").json()["data"]
        self.assertEqual(cart["items"][0]["product_slug"], self.shop.product.slug)
        quote = self.client.post("/api/orders/quote/", {"shipping_method": self.shop.shipping.pk}, format="json").json()["data"]
        # products 200 + shipping 30 + packaging 20 = 250; tax 10% = 25
        self.assertEqual((quote["tax_amount"], quote["payable_total"]), ("25.00", "275.00"))
        created = self.client.post("/api/orders/", self.shop.order_payload(self.address), format="json",
                                   HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["data"]["order"]["payable_total"], "275.00")
        self.assertTrue(created.json()["data"]["payment_redirect_url"].startswith("https://bank.test/pay/"))

    def test_bank_return_is_verified_before_the_order_is_paid(self) -> None:
        created = self.client.post("/api/orders/", self.shop.order_payload(self.address), format="json",
                                   HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex).json()["data"]
        order = Order.objects.get(order_number=created["order_number"])
        authority = order.payment_attempts.get().authority

        # The redirect claims success but the bank does not confirm it: nothing is paid.
        response = APIClient().get("/api/payments/return/", {"authority": authority, "status": "OK"})
        self.assertIn("status=failed", response["Location"])
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.FAILED)

        retry = self.client.post(f"/api/me/orders/{order.order_number}/pay/").json()["data"]["payment_redirect_url"]
        authority = retry.rsplit("/", 1)[1]
        verified = PaymentVerification(True, "REF-1", order.payable_total, "")
        with mock.patch.dict(FakeBankGateway.verified, {authority: verified}):
            response = APIClient().get("/api/payments/return/", {"authority": authority, "status": "OK"})
            again = APIClient().get("/api/payments/return/", {"authority": authority, "status": "OK"})
        self.assertIn(f"order={order.order_number}&status=success&result=SUCCESS&ref=REF-1", response["Location"])
        self.assertEqual(again["Location"], response["Location"])
        order.refresh_from_db()
        self.assertEqual((order.payment_status, order.order_status), ("PAID", "IN_PREPARATION"))
        self.assertTrue(order.user.notifications.filter(type="ORDER", channel="IN_APP").exists())
