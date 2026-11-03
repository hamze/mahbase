from django.db import models

from catalog.models.product_variant import QUANTITY


class CartItem(models.Model):
    """A cart line. Prices are never stored; they are computed from the variant on every read and at checkout."""

    cart = models.ForeignKey("commerce.Cart", on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.CASCADE, related_name="+")
    quantity = models.DecimalField(**QUANTITY)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["cart", "variant"], name="uniq_cart_variant"),
            models.CheckConstraint(name="cart_item_quantity_positive", condition=models.Q(quantity__gt=0)),
        ]
