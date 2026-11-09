from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import MediaAsset
from catalog.tests.helpers import make_staff, png_upload
from commerce.models import Banner, Notification, Order, StoreSettings
from commerce.tests.helpers import GATEWAY_SECRET, ShopFixture
from commerce.tests.test_order_workflows import checkout


@override_settings(PAYMENT_GATEWAY_SECRET=GATEWAY_SECRET)
class ReviewTests(TestCase):
    def setUp(self) -> None:
        self.shop = ShopFixture()
        self.user, address = self.shop.customer("09120000001")
        self.order = Order.objects.get(
            order_number=checkout(self.user, self.shop.order_payload(address)).data["order_number"]
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/products/{self.shop.product.slug}/reviews/"

    def test_only_a_delivered_order_proves_the_purchase(self) -> None:
        payload = {"rating": 5, "body": "Great"}
        self.assertEqual(self.client.post(self.url, payload).status_code, 400)

        Order.objects.filter(pk=self.order.pk).update(order_status=Order.Status.DELIVERED)
        response = self.client.post(self.url, payload)
        self.assertEqual((response.status_code, response.data["status"]), (201, "PENDING"))
        self.assertEqual(self.client.post(self.url, payload).status_code, 409)  # one review per user and product
        self.assertEqual(APIClient().get(self.url).data["results"], [])  # not approved yet

    def test_disabled_reviews_refuse_submission_and_display(self) -> None:
        Order.objects.filter(pk=self.order.pk).update(order_status=Order.Status.DELIVERED)
        StoreSettings.objects.update_or_create(pk=1, defaults={"store_name": "S", "reviews_enabled": False})

        self.assertEqual(self.client.post(self.url, {"rating": 5, "body": "x"}).status_code, 403)
        self.assertEqual(APIClient().get(self.url).status_code, 403)


class SettingsBannerTests(TestCase):
    def setUp(self) -> None:
        self.admin = APIClient()
        self.admin.force_authenticate(make_staff("admin"))

    def test_settings_is_a_validated_singleton_with_a_safe_public_view(self) -> None:
        payload = {
            "store_name": "Shop", "primary_color": "#112233", "social_links": {"instagram": "https://i.example"},
            "trust_badges": [], "default_profit_percentage": "35", "footer_text": "<p>hi</p><script>x()</script>",
        }
        self.assertEqual(self.admin.put("/api/settings/", payload, format="json").status_code, 200)
        unknown = {**payload, "social_links": {"myspace": "https://m.example"}}
        self.assertEqual(self.admin.put("/api/settings/", unknown, format="json").status_code, 400)

        public = APIClient().get("/api/settings/").data
        self.assertEqual((public["store_name"], public["footer_text"]), ("Shop", "<p>hi</p>x()"))
        self.assertNotIn("default_profit_percentage", public)
        self.assertNotIn("sms_notifications_enabled", public)
        self.assertEqual(StoreSettings.objects.count(), 1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            StoreSettings.objects.create(id=2, store_name="second")

    def test_public_banners_respect_the_window_boundaries(self) -> None:
        now = timezone.now()
        image = MediaAsset.objects.create(file=png_upload(), image_type="temporary", temporary_since=now)
        cases = {
            "open": (None, None),
            "starts-now": (now - timedelta(seconds=1), None),
            "ended": (None, now - timedelta(seconds=1)),
            "future": (now + timedelta(hours=1), None),
        }
        for title, (start_at, end_at) in cases.items():
            Banner.objects.create(title=title, image=image, position="HERO", start_at=start_at, end_at=end_at)
        Banner.objects.create(title="inactive", image=image, position="HERO", is_active=False)

        titles = [banner["title"] for banner in APIClient().get("/api/banners/").data]
        self.assertEqual(titles, ["open", "starts-now"])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Banner.objects.create(title="bad", image=image, position="HERO", start_at=now, end_at=now)


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class ContactAndNotificationTests(TestCase):
    def test_contact_form_is_rate_limited(self) -> None:
        message = {"name": "Ali", "mobile": "09121111111", "subject": "Hi", "message": "Hello"}
        client = APIClient()

        self.assertEqual(client.post("/api/contact-messages/", message).status_code, 201)
        self.assertEqual(client.post("/api/contact-messages/", message).status_code, 429)
        other_ip = APIClient(REMOTE_ADDR="10.0.0.2")
        self.assertEqual(other_ip.post("/api/contact-messages/", message).status_code, 429)  # same mobile

    def test_customers_only_see_their_own_notifications(self) -> None:
        shop = ShopFixture()
        owner, _ = shop.customer("09120000001")
        other, _ = shop.customer("09120000002")
        mine = Notification.objects.create(user=owner, type="SYSTEM", title="t", body="b")
        theirs = Notification.objects.create(user=other, type="SYSTEM", title="t", body="b")
        client = APIClient()
        client.force_authenticate(owner)

        self.assertEqual([n["id"] for n in client.get("/api/me/notifications/").data["results"]], [mine.pk])
        self.assertEqual(client.patch(f"/api/me/notifications/{theirs.pk}/read/").status_code, 404)
        self.assertEqual(client.patch(f"/api/me/notifications/{mine.pk}/read/").data["status"], "READ")
        self.assertEqual(client.get("/api/notifications/").status_code, 403)
