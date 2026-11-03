import threading
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import ProductVariant
from catalog.tests.helpers import make_staff
from commerce.models import AuditLog, DiscountCode, InvalidTransition, Order, OrderRefund, ReturnRequest, ShippingMethod
from commerce.services.checkout import place_admin_order, request_fingerprint
from commerce.services.refunds import process_refund
from commerce.tests.helpers import GATEWAY_SECRET, ShopFixture, post_callback

refund_inline = mock.patch("commerce.tasks.process_refund_task.delay", side_effect=process_refund)


def checkout(user: object, payload: dict, key: str | None = None) -> object:
    client = APIClient()
    client.force_authenticate(user)
    return client.post("/api/orders/", payload, format="json", HTTP_IDEMPOTENCY_KEY=key or uuid.uuid4().hex)


def callback(order: Order, txn: str, amount: Decimal | None = None) -> dict:
    return {
        "order_number": order.order_number,
        "idempotency_key": f"cb-{txn}",
        "gateway_transaction_id": txn,
        "amount": str(amount if amount is not None else order.payable_total),
        "status": "SUCCESS",
    }


@override_settings(PAYMENT_GATEWAY_SECRET=GATEWAY_SECRET)
class ConcurrencyTests(TransactionTestCase):
    def test_concurrent_checkouts_never_reserve_more_than_available(self) -> None:
        shop = ShopFixture()  # stock 5; each customer wants 2
        customers = [shop.customer(f"0912000000{i}") for i in range(4)]
        statuses = []

        def buy(user: object, address: object) -> None:
            try:
                statuses.append(checkout(user, shop.order_payload(address)).status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=buy, args=customer) for customer in customers]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        shop.variant.refresh_from_db()
        self.assertEqual(sorted(statuses), [201, 201, 422, 422])
        self.assertEqual(shop.variant.reserved_quantity, Decimal("4"))
        self.assertEqual(Order.objects.count(), 2)

    @refund_inline
    def test_expiry_racing_payment_applies_exactly_one(self, _delay: object) -> None:
        shop = ShopFixture()
        user, address = shop.customer("09120000001")
        order = Order.objects.get(order_number=checkout(user, shop.order_payload(address)).data["order_number"])
        Order.objects.filter(pk=order.pk).update(reservation_expires_at=timezone.now() - timedelta(minutes=1))
        responses = []

        def expire() -> None:
            try:
                Order.expire_reservation(order.pk)
            finally:
                connection.close()

        def pay() -> None:
            try:
                responses.append(post_callback(APIClient(), callback(order, "T-1")).status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=expire), threading.Thread(target=pay)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        order.refresh_from_db()
        shop.variant.refresh_from_db()
        self.assertEqual(responses, [200])
        self.assertEqual(shop.variant.reserved_quantity, Decimal("0"))
        if order.stock_reservation_status == Order.ReservationStatus.CONVERTED:
            self.assertEqual((order.payment_status, shop.variant.stock_quantity), ("PAID", Decimal("3")))
        else:
            # Expiry won: stock is back and the late payment is refunded instead of applied.
            self.assertEqual(shop.variant.stock_quantity, Decimal("5"))
            refund = order.refunds.get()
            self.assertEqual((refund.reason, refund.status), ("PAYMENT_AFTER_RELEASE", "COMPLETED"))


@override_settings(PAYMENT_GATEWAY_SECRET=GATEWAY_SECRET)
class CheckoutAndPaymentTests(TestCase):
    def setUp(self) -> None:
        self.shop = ShopFixture()
        self.user, self.address = self.shop.customer("09120000001")

    def test_rejected_line_leaves_cart_coupon_and_reservation_untouched(self) -> None:
        code = DiscountCode.objects.create(code="OFF10", product_discount_type="PERCENTAGE", percentage=10)
        other = ProductVariant.objects.get(sku="SHIRT-M")
        cart = self.user.carts.get()
        cart.items.create(variant=other, quantity=Decimal("6"))  # only 5 in stock

        response = checkout(self.user, self.shop.order_payload(self.address, discount_code="off10"))

        self.assertEqual(response.status_code, 422, response.data)
        self.assertIn(str(other.pk), response.data["lines"])
        self.assertFalse(Order.objects.exists())
        self.assertEqual(cart.items.count(), 2)
        code.refresh_from_db()
        self.assertEqual(code.used_count, 0)
        self.assertEqual(
            sorted(ProductVariant.objects.values_list("reserved_quantity", flat=True)), [Decimal("0"), Decimal("0")]
        )

    @refund_inline
    def test_confirmed_stock_reduction_invalidates_order_and_payment_is_refunded(self, _delay: object) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        admin = APIClient()
        admin.force_authenticate(make_staff("admin"))
        url = f"/api/variants/{self.shop.variant.pk}/stock/"

        warning = admin.patch(url, {"stock_quantity": "1"}, format="json")
        self.assertEqual(warning.status_code, 409)
        self.assertEqual(warning.data["shortfall"], Decimal("1"))
        self.assertEqual(warning.data["affected_orders"], [{"order_number": order.order_number, "quantity": Decimal("2")}])
        self.assertEqual(admin.patch(url, {"stock_quantity": "1", "confirm": True}, format="json").status_code, 200)
        order.refresh_from_db()
        self.assertTrue(order.stock_invalidated)
        self.assertTrue(AuditLog.objects.filter(action="variant.stock_below_reserved_confirmed").exists())

        with self.captureOnCommitCallbacks(execute=True):
            response = post_callback(self.client, callback(order, "T-1"))

        self.assertEqual((response.status_code, response.json()["result"]), (200, "SUCCESS_BUT_REJECTED"))
        order.refresh_from_db()
        self.shop.variant.refresh_from_db()
        self.assertEqual(
            (order.order_status, order.payment_status, order.stock_reservation_status, order.cancellation_reason),
            ("CANCELLED", "REFUNDED", "RELEASED", "STOCK_INVALIDATED"),
        )
        self.assertEqual((self.shop.variant.stock_quantity, self.shop.variant.reserved_quantity), (Decimal("1"), Decimal("0")))
        refund = order.refunds.get()
        self.assertEqual((refund.reason, refund.status, refund.amount), ("STOCK_INVALIDATED", "COMPLETED", order.payable_total))
        self.assertEqual(order.refunded_total, order.paid_total)

    @refund_inline
    def test_payment_with_a_different_amount_is_refunded_not_applied(self, _delay: object) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        captured = order.payable_total + Decimal("50")

        with self.captureOnCommitCallbacks(execute=True):
            response = post_callback(self.client, callback(order, "T-1", captured))

        self.assertEqual((response.status_code, response.json()["result"]), (200, "SUCCESS_BUT_REJECTED"))
        order.refresh_from_db()
        self.shop.variant.refresh_from_db()
        self.assertEqual(
            (order.order_status, order.payment_status, order.stock_reservation_status, order.cancellation_reason),
            ("CANCELLED", "REFUNDED", "RELEASED", "PAYMENT_AMOUNT_MISMATCH"),
        )
        self.assertEqual(self.shop.variant.reserved_quantity, Decimal("0"))
        refund = order.refunds.get()
        self.assertEqual((refund.reason, refund.status, refund.amount), ("PAYMENT_AMOUNT_MISMATCH", "COMPLETED", captured))
        self.assertEqual((order.paid_total, order.refunded_total), (captured, captured))

    def test_gateway_transaction_of_another_order_is_rejected(self) -> None:
        first = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        other_user, other_address = self.shop.customer("09120000002")
        second = Order.objects.get(order_number=checkout(other_user, self.shop.order_payload(other_address)).data["order_number"])

        self.assertEqual(post_callback(self.client, callback(first, "T-1")).status_code, 200)
        self.assertEqual(post_callback(self.client, callback(first, "T-1")).status_code, 200)  # idempotent retry
        duplicate = post_callback(self.client, {**callback(second, "T-1"), "idempotency_key": "cb-other"})

        self.assertEqual(duplicate.status_code, 409)
        second.refresh_from_db()
        self.assertEqual((second.payment_status, second.stock_reservation_status), ("UNPAID", "RESERVED"))
        self.shop.variant.refresh_from_db()
        self.assertEqual((self.shop.variant.stock_quantity, self.shop.variant.reserved_quantity), (Decimal("3"), Decimal("2")))

    def test_repeated_key_with_a_different_body_is_rejected(self) -> None:
        payload = self.shop.order_payload(self.address)
        created = checkout(self.user, payload, "k-1")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(checkout(self.user, payload, "k-1").status_code, 200)

        other = ShippingMethod.objects.create(name="Courier", price=Decimal("50"))
        reused = checkout(self.user, {**payload, "shipping_method": other.pk}, "k-1")

        self.assertEqual(reused.status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    @refund_inline
    def test_late_payment_after_release_is_recorded_as_refunded(self, _delay: object) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        self.assertTrue(Order.expire_reservation(order.pk))

        with self.captureOnCommitCallbacks(execute=True):
            response = post_callback(self.client, callback(order, "T-1"))

        self.assertEqual(response.json()["result"], "REJECTED_AFTER_RELEASE")
        order.refresh_from_db()
        self.shop.variant.refresh_from_db()
        self.assertEqual((order.order_status, order.payment_status), ("CANCELLED", "REFUNDED"))
        self.assertEqual((order.paid_total, order.refunded_total), (order.payable_total, order.payable_total))
        self.assertEqual((self.shop.variant.stock_quantity, self.shop.variant.reserved_quantity), (Decimal("5"), Decimal("0")))

    def test_admin_cannot_cancel_while_payment_is_pending(self) -> None:
        order_number = checkout(self.user, self.shop.order_payload(self.address)).data["order_number"]
        customer = APIClient()
        customer.force_authenticate(self.user)
        self.assertEqual(customer.post(f"/api/me/orders/{order_number}/pay/").status_code, 200)
        admin = APIClient()
        admin.force_authenticate(make_staff("admin"))

        response = admin.post(f"/api/admin/orders/{order_number}/cancel/")

        self.assertEqual(response.status_code, 409)
        order = Order.objects.get(order_number=order_number)
        self.assertEqual((order.order_status, order.stock_reservation_status), ("PENDING_PAYMENT", "RESERVED"))

    def test_return_refund_is_capped_by_open_refunds(self) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        post_callback(self.client, callback(order, "T-1"))
        Order.objects.filter(pk=order.pk).update(order_status=Order.Status.DELIVERED)
        order.refresh_from_db()
        admin = make_staff("admin")
        item = order.items.get()
        first = ReturnRequest.open(order, "Damaged", [(item, Decimal("1"))], self.user)
        second = ReturnRequest.open(order, "Wrong size", [(item, Decimal("1"))], self.user)
        for request in (first, second):
            request.approve()
            request.receive({line.pk: True for line in request.items.all()})

        first.start_refund(admin, order.paid_total - Decimal("50"))  # still APPROVED, not yet completed

        self.assertEqual(second.default_refund_amount(), Decimal("50"))
        with self.assertRaises(ValidationError):
            second.start_refund(admin, Decimal("100"))

    @refund_inline
    def test_second_payment_after_release_is_not_refunded_again(self, _delay: object) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        self.assertTrue(Order.expire_reservation(order.pk))

        with self.captureOnCommitCallbacks(execute=True):
            post_callback(self.client, callback(order, "T-1"))
            second = post_callback(self.client, callback(order, "T-2"))

        self.assertEqual((second.status_code, second.json()["result"]), (200, "DUPLICATE_REJECTED"))
        order.refresh_from_db()
        self.assertEqual(order.refunds.count(), 1)
        self.assertEqual((order.paid_total, order.refunded_total), (order.payable_total, order.payable_total))

    def test_callback_idempotency_key_of_another_order_is_rejected(self) -> None:
        first = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        other_user, other_address = self.shop.customer("09120000002")
        second = Order.objects.get(order_number=checkout(other_user, self.shop.order_payload(other_address)).data["order_number"])
        post_callback(self.client, callback(first, "T-1"))

        response = post_callback(self.client, {**callback(second, "T-2"), "idempotency_key": "cb-T-1"})

        self.assertEqual(response.status_code, 409)
        second.refresh_from_db()
        self.assertEqual((second.payment_status, second.stock_reservation_status), ("UNPAID", "RESERVED"))

    def test_cancellation_refund_covers_only_what_is_left_to_refund(self) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        post_callback(self.client, callback(order, "T-1"))
        Order.objects.filter(pk=order.pk).update(
            payment_status=Order.PaymentStatus.PARTIALLY_REFUNDED, refunded_total=order.payable_total - Decimal("30")
        )
        admin = APIClient()
        admin.force_authenticate(make_staff("admin"))
        url = f"/api/admin/orders/{order.order_number}/cancel/"

        created = admin.post(url)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(Decimal(created.data["amount"]), Decimal("30"))

        OrderRefund.objects.filter(pk=created.data["id"]).update(status=OrderRefund.Status.REJECTED)
        OrderRefund.objects.create(order=order, amount=Decimal("30"), reason=OrderRefund.Reason.RETURN)
        self.assertEqual(admin.post(url).status_code, 409)  # the open refund already commits the remainder

    def test_cancellation_refund_is_refused_while_a_return_refund_is_open(self) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        post_callback(self.client, callback(order, "T-1"))
        OrderRefund.objects.create(order=order, amount=Decimal("10"), reason=OrderRefund.Reason.RETURN)
        admin = APIClient()
        admin.force_authenticate(make_staff("admin"))

        self.assertEqual(admin.post(f"/api/admin/orders/{order.order_number}/cancel/").status_code, 409)
        self.assertFalse(order.refunds.filter(reason=OrderRefund.Reason.ADMIN_CANCEL_BEFORE_SHIP).exists())

    def test_stale_return_transition_is_checked_against_the_locked_status(self) -> None:
        order = Order.objects.get(order_number=checkout(self.user, self.shop.order_payload(self.address)).data["order_number"])
        post_callback(self.client, callback(order, "T-1"))
        Order.objects.filter(pk=order.pk).update(order_status=Order.Status.DELIVERED)
        order.refresh_from_db()
        request = ReturnRequest.open(order, "Damaged", [(order.items.get(), Decimal("1"))], self.user)
        request.approve()
        stale = ReturnRequest.objects.get(pk=request.pk)

        request.receive({line.pk: True for line in request.items.all()})

        with self.assertRaises(InvalidTransition):
            stale.reject()
        stale.refresh_from_db()
        self.assertEqual(stale.status, ReturnRequest.Status.RECEIVED)

    def test_customer_is_limited_to_customer_routes(self) -> None:
        client = APIClient()
        client.force_authenticate(self.user)
        me = client.get("/api/auth/me/").data
        self.assertEqual((me["customer_tier"], me["is_staff"], me["permissions"]), ("RETAIL", False, []))
        self.assertEqual(client.get("/api/me/addresses/").status_code, 200)
        self.assertEqual(client.get("/api/products/").status_code, 403)
        self.assertEqual(client.get("/api/admin/orders/").status_code, 403)
        staff = APIClient()
        staff.force_authenticate(make_staff("clerk", permissions=("products.edit",)))
        self.assertEqual(staff.get("/api/admin/orders/").status_code, 403)
        self.assertEqual(staff.get("/api/cart/").status_code, 403)


class AdminOrderCreateTests(TestCase):
    def setUp(self) -> None:
        self.shop = ShopFixture()
        self.admin = APIClient()
        self.admin.force_authenticate(make_staff("seller", permissions=("admin.orders.create",)))

    def create(self, payload: dict, key: str) -> object:
        return self.admin.post("/api/admin/orders/", payload, format="json", HTTP_IDEMPOTENCY_KEY=key)

    def payload(self, quantity: str) -> dict:
        return {
            "new_customer": {"mobile": "+98 912 000 0009", "first_name": "Sara"},
            "new_address": {
                "title": "Home", "receiver_name": "Sara", "receiver_mobile": "09120000009",
                "province": self.shop.province.pk, "city": self.shop.city.pk, "address_line": "Street 1",
                "postal_code": "1234567890",
            },
            "shipping_method": self.shop.shipping.pk,
            "items": [{"variant": self.shop.variant.pk, "quantity": quantity}],
        }

    def test_new_customer_order_is_atomic_and_idempotent(self) -> None:
        rejected = self.create(self.payload("6"), "k-1")  # only 5 in stock
        self.assertEqual(rejected.status_code, 422, rejected.data)
        self.assertFalse(User.objects.filter(username="09120000009").exists())

        created = self.create(self.payload("2"), "k-2")
        self.assertEqual(created.status_code, 201, created.data)
        retry = self.create(self.payload("2"), "k-2")  # the customer exists now; the key still finds the order
        self.assertEqual((retry.status_code, retry.data["order_number"]), (200, created.data["order_number"]))

        order = Order.objects.get()
        self.assertEqual((order.user.username, order.user.profile.created_source), ("09120000009", "ADMIN_CREATED"))
        self.assertEqual(order.user.addresses.get().is_default, True)
        self.shop.variant.refresh_from_db()
        self.assertEqual(self.shop.variant.reserved_quantity, Decimal("2"))
        self.assertTrue(AuditLog.objects.filter(action="order.created_by_admin", target_id=str(order.pk)).exists())

    def test_racing_retry_that_missed_the_lookup_returns_the_first_order(self) -> None:
        created = self.create(self.payload("2"), "k-1")
        self.assertEqual(created.status_code, 201, created.data)
        order = Order.objects.get()
        # A concurrent duplicate passed the lookup and validation before the first request committed, so it tries
        # to create the same customer.
        duplicate, created_again = place_admin_order(
            order.user, "k-1", request_fingerprint(self.payload("2")),
            customer=None, new_customer={"mobile": "09120000009"}, address_id=order.user.addresses.get().pk,
            new_address=None, shipping_method_id=self.shop.shipping.pk, discount_code="",
            lines={self.shop.variant.pk: Decimal("2")},
        )
        self.assertEqual((duplicate.pk, created_again), (order.pk, False))
        self.assertEqual(User.objects.filter(username="09120000009").count(), 1)
