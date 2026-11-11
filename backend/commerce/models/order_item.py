from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.db import models
from django.db.models import F, Q

from catalog.models.product_variant import CENT, PRICE, QUANTITY
from commerce.models.order import InvalidTransition

if TYPE_CHECKING:
    from catalog.models import ProductVariant


class OrderItem(models.Model):
    """Order line with catalog snapshots; prices are copied as decimals from the catalog at confirmation.

    ``unit_price`` is after the product discount; ``line_total`` excludes the discount code.
    """

    class PreparationStatus(models.TextChoices):
        PENDING = "PENDING"
        PREPARING = "PREPARING"
        PREPARED = "PREPARED"

    PREPARATION_TRANSITIONS = {
        PreparationStatus.PENDING: {PreparationStatus.PREPARING},
        PreparationStatus.PREPARING: {PreparationStatus.PREPARED},
    }

    order = models.ForeignKey("commerce.Order", on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    variant = models.ForeignKey(
        "catalog.ProductVariant", null=True, blank=True, on_delete=models.SET_NULL, related_name="order_items"
    )
    product_name_snapshot = models.CharField(max_length=255)
    variant_label_snapshot = models.CharField(max_length=255, blank=True)
    sku_snapshot = models.CharField(max_length=100)
    unit_name_snapshot = models.CharField(max_length=50)
    quantity = models.DecimalField(**QUANTITY)
    original_unit_price_snapshot = models.DecimalField(**PRICE)
    unit_price = models.DecimalField(**PRICE)
    product_discount_per_unit = models.DecimalField(**PRICE, default=Decimal("0"))
    line_product_discount_total = models.DecimalField(**PRICE, default=Decimal("0"))
    line_total = models.DecimalField(**PRICE)
    preparation_status = models.CharField(
        max_length=10, choices=PreparationStatus.choices, default=PreparationStatus.PENDING
    )
    returned_quantity = models.DecimalField(**QUANTITY, default=Decimal("0"))
    restocked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(name="order_item_quantity_positive", condition=Q(quantity__gt=0)),
            models.CheckConstraint(
                name="order_item_returned_lte_quantity",
                condition=Q(returned_quantity__gte=0, returned_quantity__lte=F("quantity")),
            ),
        ]

    def transition_preparation_status(self, new_status: str) -> None:
        """Validate and set ``preparation_status`` (caller saves); raises ``InvalidTransition``."""
        if new_status not in self.PREPARATION_TRANSITIONS.get(self.preparation_status, set()):
            raise InvalidTransition(f"وضعیت آماده‌سازی از {self.preparation_status} به {new_status} قابل تغییر نیست.")
        self.preparation_status = new_status

    @classmethod
    def from_variant(cls, variant: "ProductVariant", quantity: Decimal, customer_tier: str) -> "OrderItem":
        """Unsaved, priced line with snapshots (variant needs ``product__unit`` and attributes loaded).

        Prices come only from the catalog; the decimals are copied as they are.
        """
        original, discount = variant.price_for(customer_tier)
        unit_price = original - discount
        return cls(
            product=variant.product,
            variant=variant,
            product_name_snapshot=variant.product.name,
            variant_label_snapshot="، ".join(
                f"{value.attribute.name}: {value.value}" for value in variant.attributes.all()
            ),
            sku_snapshot=variant.sku,
            unit_name_snapshot=variant.product.unit.name,
            quantity=quantity,
            original_unit_price_snapshot=original,
            unit_price=unit_price,
            product_discount_per_unit=discount,
            line_product_discount_total=(discount * quantity).quantize(CENT, rounding=ROUND_HALF_UP),
            line_total=(unit_price * quantity).quantize(CENT, rounding=ROUND_HALF_UP),
        )
