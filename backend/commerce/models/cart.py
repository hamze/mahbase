from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Q

from catalog.models import ProductVariant


class Cart(models.Model):
    """Database cart of a customer (one ACTIVE per user). Guest carts live only in the session."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="carts")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user"], condition=Q(status="ACTIVE"), name="uniq_active_cart_per_user")
        ]

    @classmethod
    def active_for(cls, user: User, *, lock: bool = False) -> "Cart":
        queryset = cls.objects.select_for_update() if lock else cls.objects
        cart, _ = queryset.get_or_create(user=user, status=cls.Status.ACTIVE)
        return cart

    @classmethod
    def merge_session(cls, user: User, session_items: dict[str, str]) -> list[str]:
        """Merge a guest session cart (``{variant_id: quantity}``) in one transaction; returns warnings.

        Per variant (locked in ascending id order): database + session quantity, capped by ``max_purchase`` and
        availability and rounded down to ``purchase_step``; lines below ``min_purchase`` are dropped.
        """
        warnings = []
        with transaction.atomic():
            cart = cls.active_for(user, lock=True)
            existing = {item.variant_id: item for item in cart.items.all()}
            variant_ids = sorted({int(variant_id) for variant_id in session_items})
            variants = ProductVariant.objects.select_for_update().filter(pk__in=variant_ids).order_by("pk")
            for variant in variants.select_related("product"):
                item = existing.get(variant.pk)
                merged = Decimal(session_items[str(variant.pk)]) + (item.quantity if item else 0)
                quantity = variant.clamp_quantity(merged) if variant.is_sellable() else None
                if quantity is None:
                    warnings.append(f"{variant.sku}: removed from the cart (not available in the minimum quantity).")
                    if item:
                        item.delete()
                    continue
                if quantity != merged:
                    warnings.append(f"{variant.sku}: quantity adjusted to {quantity.normalize()}.")
                cart.items.update_or_create(variant=variant, defaults={"quantity": quantity})
        return warnings
