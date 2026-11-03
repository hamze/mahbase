"""Cart storage for both cart kinds: customers use the database ``Cart``; guests only the session."""

from decimal import Decimal

from django.db.models import QuerySet
from rest_framework.request import Request

from accounts.models import UserProfile
from catalog.models import ProductVariant
from commerce.models import Cart, OrderItem

SESSION_CART_KEY = "cart"
SESSION_MERGE_WARNINGS_KEY = "cart_merge_warnings"


def line_variants() -> QuerySet:
    """Variants with everything needed to price and snapshot a line."""
    return ProductVariant.objects.select_related("product__unit", "product__category").prefetch_related(
        "attributes__attribute"
    )


def cart_quantities(request: Request) -> dict[int, Decimal]:
    if request.user.is_authenticated:
        return {item.variant_id: item.quantity for item in Cart.active_for(request.user).items.all()}
    return {int(variant_id): Decimal(quantity) for variant_id, quantity in request.session.get(SESSION_CART_KEY, {}).items()}


def set_cart_quantity(request: Request, variant_id: int, quantity: Decimal | None) -> None:
    """Set a line's quantity; ``None`` removes it."""
    if request.user.is_authenticated:
        cart = Cart.active_for(request.user)
        if quantity is None:
            cart.items.filter(variant_id=variant_id).delete()
        else:
            cart.items.update_or_create(variant_id=variant_id, defaults={"quantity": quantity})
        return
    items = dict(request.session.get(SESSION_CART_KEY, {}))
    if quantity is None:
        items.pop(str(variant_id), None)
    else:
        items[str(variant_id)] = str(quantity)
    request.session[SESSION_CART_KEY] = items


def clear_cart(request: Request) -> None:
    if request.user.is_authenticated:
        Cart.active_for(request.user).items.all().delete()
    else:
        request.session.pop(SESSION_CART_KEY, None)


def priced_lines(request: Request) -> list[OrderItem]:
    """Unsaved priced lines for the current cart, each with ``warnings`` from the purchase rules (revalidation)."""
    quantities = cart_quantities(request)
    tier = UserProfile.tier_of(request.user) if request.user.is_authenticated else UserProfile.CustomerTier.RETAIL
    lines = []
    for variant in line_variants().filter(pk__in=quantities).order_by("pk"):
        line = OrderItem.from_variant(variant, quantities[variant.pk], tier)
        line.warnings = variant.purchase_errors(quantities[variant.pk])
        lines.append(line)
    return lines
