"""Final order confirmation: order, snapshots, reservation and coupon use in one transaction.

Customers confirm their cart (``POST /api/orders/``); admins place an order with explicit lines on behalf of an
existing or a new customer (``POST /api/admin/orders/``). Both go through the same validation and reservation.
"""

import hashlib
import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F

from accounts.models import UserProfile
from catalog.models import ProductVariant
from commerce.models import (
    Address,
    AuditLog,
    Cart,
    DiscountCode,
    Order,
    OrderAddressSnapshot,
    OrderItem,
    ShippingMethod,
    StoreSettings,
)
from commerce.services.cart import line_variants


ADMIN_KEY_PREFIX = "admin-"


class IdempotencyKeyReused(Exception):
    """The idempotency key already placed an order for a different request body (mapped to 409)."""


def request_fingerprint(data: dict) -> str:
    """Stable hash of the confirmation request body, stored with the order its idempotency key placed."""
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _existing_order(user: User | None, idempotency_key: str, fingerprint: str) -> Order | None:
    orders = Order.objects.filter(idempotency_key=idempotency_key)
    if user is not None:
        orders = orders.filter(user=user)
    existing = orders.first()
    if existing is not None and existing.request_fingerprint != fingerprint:
        raise IdempotencyKeyReused()
    return existing


class CheckoutRejected(Exception):
    """One or more order lines fail the purchase rules; nothing was written (mapped to 422 with per-line errors)."""

    def __init__(self, errors: dict) -> None:
        super().__init__("Checkout rejected.")
        self.errors = errors


def place_order(
    user: User,
    idempotency_key: str,
    address_id: int,
    shipping_method_id: int,
    discount_code: str,
    fingerprint: str,
    lines: dict[int, Decimal] | None = None,
) -> tuple[Order, bool]:
    """Create the order from the customer's cart (or from ``lines`` {variant_id: quantity}, leaving the cart alone),
    or return the existing order for the same idempotency key and request ``fingerprint``.

    Returns ``(order, created)``. Any failure rolls back everything: no order, reservation, coupon use or cart change.
    Raises ``IdempotencyKeyReused`` when the key already placed an order for a different request.
    """
    if existing := _existing_order(user, idempotency_key, fingerprint):
        return existing, False
    try:
        with transaction.atomic():
            order = _place(user, idempotency_key, fingerprint, address_id, shipping_method_id, discount_code, lines)
            return order, True
    except IntegrityError:
        # A concurrent request with the same key committed first.
        existing = _existing_order(user, idempotency_key, fingerprint)
        if existing is None:
            raise
        return existing, False


def find_admin_order(idempotency_key: str, fingerprint: str) -> Order | None:
    """The order an earlier admin request with this key placed. Checked before input validation: a retry of a request
    that created the customer would otherwise fail on the now-existing mobile. Raises ``IdempotencyKeyReused`` when
    the key was used for a different request.
    """
    return _existing_order(None, ADMIN_KEY_PREFIX + idempotency_key, fingerprint)


def place_admin_order(
    admin: User,
    idempotency_key: str,
    fingerprint: str,
    *,
    customer: User | None,
    new_customer: dict | None,
    address_id: int | None,
    new_address: dict | None,
    shipping_method_id: int,
    discount_code: str,
    lines: dict[int, Decimal],
) -> tuple[Order, bool]:
    """Admin order for an existing customer or a new one (created with ``ADMIN_CREATED``), with an existing or a new
    address. The customer, the address and the order are created together or not at all.

    The idempotency key is stored as ``admin-<key>``; callers look it up first with ``find_admin_order``.
    """
    key = ADMIN_KEY_PREFIX + idempotency_key
    try:
        with transaction.atomic():
            if customer is None:
                customer = UserProfile.create_customer(
                    new_customer["mobile"],
                    UserProfile.CreatedSource.ADMIN_CREATED,
                    first_name=new_customer.get("first_name", ""),
                    last_name=new_customer.get("last_name", ""),
                    customer_tier=new_customer.get("customer_tier", UserProfile.CustomerTier.RETAIL),
                )
            if new_address is not None:
                address = Address.objects.create(user=customer, **new_address)
                if not Address.objects.active().filter(user=customer, is_default=True).exists():
                    address.make_default()
                address_id = address.pk
            order, created = place_order(customer, key, address_id, shipping_method_id, discount_code, fingerprint, lines)
            if created:
                AuditLog.record(
                    admin, "order.created_by_admin", order, customer=customer.pk, new_customer=new_customer is not None
                )
    except IntegrityError:
        # A concurrent request with the same key committed first and created the same new customer.
        existing = _existing_order(None, key, fingerprint)
        if existing is None:
            raise
        return existing, False
    return order, created


def _place(
    user: User,
    idempotency_key: str,
    fingerprint: str,
    address_id: int,
    shipping_method_id: int,
    discount_code: str,
    lines: dict[int, Decimal] | None,
) -> Order:
    tier = UserProfile.tier_of(user)
    # 1. Insert the order first: the unique (user, idempotency_key) row serializes duplicate submissions.
    order = Order.objects.create(
        order_number=Order.new_order_number(),
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        user=user,
        customer_tier_snapshot=tier,
        reservation_expires_at=Order.reservation_deadline(),
    )

    # 2. The lines: the cart (locked so a concurrent cart edit cannot slip between validation and clearing), or the
    #    admin's explicit lines.
    cart = None
    if lines is None:
        cart = Cart.active_for(user, lock=True)
        quantities = {item.variant_id: item.quantity for item in cart.items.all()}
        if not quantities:
            raise CheckoutRejected({"cart": ["سبد خرید شما خالی است."]})
    else:
        quantities = lines

    # 3. Lock every variant in ascending id order, then validate every line before writing anything else.
    variants = list(line_variants().select_for_update(of=("self",)).filter(pk__in=quantities).order_by("pk"))
    line_errors = {
        str(variant_id): {"sku": "", "errors": ["Unknown variant."]}
        for variant_id in set(quantities) - {variant.pk for variant in variants}
    }
    for variant in variants:
        if errors := variant.purchase_errors(quantities[variant.pk]):
            line_errors[str(variant.pk)] = {"sku": variant.sku, "errors": errors}
    if line_errors:
        raise CheckoutRejected({"lines": line_errors})
    items = [OrderItem.from_variant(variant, quantities[variant.pk], tier) for variant in variants]

    # 4. Address (own, not deleted) and a shipping method serving its city.
    address = Address.objects.active().select_related("province", "city").filter(pk=address_id, user=user).first()
    if address is None:
        raise ValidationError({"address": "یکی از آدرس‌های خود را انتخاب کنید."})
    shipping = ShippingMethod.available_for(address.city_id).filter(pk=shipping_method_id).first()
    if shipping is None:
        raise ValidationError({"shipping_method": "این روش ارسال برای شهر انتخاب‌شده در دسترس نیست."})

    # 5. Discount code, locked so usage limits hold under concurrency.
    code = None
    discount_amount = shipping_discount = Decimal("0")
    if discount_code:
        code = DiscountCode.objects.select_for_update().filter(code__iexact=discount_code).first()
        if code is None:
            raise ValidationError({"discount_code": "کد تخفیف نامعتبر است."})
        discount_amount, shipping_discount = code.evaluate(
            user, [(item.product, item.line_total) for item in items], shipping.price
        )

    # 6. Lines, address snapshot and totals.
    for item in items:
        item.order = order
    OrderItem.objects.bulk_create(items)
    OrderAddressSnapshot.copy_from(order, address)
    order.subtotal_products = sum((item.line_total for item in items), Decimal("0"))
    order.product_discount_total = sum((item.line_product_discount_total for item in items), Decimal("0"))
    order.discount_code = code
    order.discount_code_snapshot = code.code if code else ""
    order.discount_amount = discount_amount
    order.shipping_method_name_snapshot = shipping.name
    order.shipping_cost = shipping.price
    order.shipping_discount_amount = shipping_discount
    store = StoreSettings.get_solo()
    order.set_totals(store.packaging_fee, store.tax_percentage)

    # 7. Reserve stock (variants are already locked) and consume the code.
    for item in items:
        ProductVariant.objects.filter(pk=item.variant_id).update(reserved_quantity=F("reserved_quantity") + item.quantity)
    if code is not None:
        DiscountCode.objects.filter(pk=code.pk).update(used_count=F("used_count") + 1)
        order.coupon_consumed = True
    order.save()

    # 8. Clear the cart (admin orders never touch it).
    if cart is not None:
        cart.items.all().delete()
    return order



def quote_order(user: User, items: list[OrderItem], shipping_method_id: int | None, discount_code: str) -> Order:
    """Unsaved order with the totals confirmation would charge for priced cart ``items`` (never changes state).

    The shipping method is checked when given (its city rule is checked at confirmation); an invalid discount code
    raises ``ValidationError`` like confirmation does.
    """
    order = Order(user=user)
    order.subtotal_products = sum((item.line_total for item in items), Decimal("0"))
    order.product_discount_total = sum((item.line_product_discount_total for item in items), Decimal("0"))
    if shipping_method_id is not None:
        shipping = ShippingMethod.objects.filter(pk=shipping_method_id, is_active=True).first()
        if shipping is None:
            raise ValidationError({"shipping_method": "روش ارسال نامعتبر است."})
        order.shipping_cost = shipping.price
    if discount_code:
        code = DiscountCode.objects.filter(code__iexact=discount_code).first()
        if code is None:
            raise ValidationError({"discount_code": "کد تخفیف نامعتبر است."})
        order.discount_amount, order.shipping_discount_amount = code.evaluate(
            user, [(item.product, item.line_total) for item in items], order.shipping_cost
        )
        order.discount_code_snapshot = code.code
    store = StoreSettings.get_solo()
    order.set_totals(store.packaging_fee, store.tax_percentage)
    return order
