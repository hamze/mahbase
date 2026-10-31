import hashlib
from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Q
from django.db.models.functions import Round

if TYPE_CHECKING:
    from catalog.models import Attribute

QUANTITY = {"max_digits": 12, "decimal_places": 3}
PRICE = {"max_digits": 14, "decimal_places": 2}
# Prices are in Toman; bulk adjustments round to whole thousands.
PRICE_ROUNDING = Decimal("1000")


class ProductVariant(models.Model):
    """Purchasable item. All quantities are in the product's purchasable unit."""

    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="variants")
    sku = models.CharField(max_length=100, unique=True)
    combination_hash = models.CharField(max_length=32)
    stock_quantity = models.DecimalField(**QUANTITY, default=Decimal("0"))
    pack_size = models.DecimalField(**QUANTITY, null=True, blank=True)
    purchase_step = models.DecimalField(**QUANTITY, default=Decimal("1"))
    min_purchase = models.DecimalField(**QUANTITY, default=Decimal("1"))
    max_purchase = models.DecimalField(**QUANTITY, default=Decimal("10"))
    base_price = models.DecimalField(**PRICE, default=Decimal("0"))
    wholesale_price = models.DecimalField(**PRICE, null=True, blank=True)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_discount_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "combination_hash"], name="uniq_variant_combination"),
            models.CheckConstraint(name="variant_stock_non_negative", condition=Q(stock_quantity__gte=0)),
            models.CheckConstraint(name="variant_purchase_step_positive", condition=Q(purchase_step__gt=0)),
            models.CheckConstraint(name="variant_min_purchase_positive", condition=Q(min_purchase__gt=0)),
            models.CheckConstraint(
                name="variant_max_purchase_gte_min", condition=Q(max_purchase__gte=F("min_purchase"))
            ),
            models.CheckConstraint(
                name="variant_pack_size_positive", condition=Q(pack_size__isnull=True) | Q(pack_size__gt=0)
            ),
            models.CheckConstraint(name="variant_base_price_non_negative", condition=Q(base_price__gte=0)),
            models.CheckConstraint(
                name="variant_wholesale_price_non_negative",
                condition=Q(wholesale_price__isnull=True) | Q(wholesale_price__gte=0),
            ),
            models.CheckConstraint(
                name="variant_discount_percentage_range",
                condition=Q(discount_percentage__isnull=True)
                | Q(discount_percentage__gte=0, discount_percentage__lte=100),
            ),
        ]

    def __str__(self) -> str:
        return self.sku

    def clean(self) -> None:
        errors = {}
        if self.stock_quantity is not None and self.stock_quantity < 0:
            errors["stock_quantity"] = "Stock cannot be negative."
        if self.purchase_step is not None and self.purchase_step <= 0:
            errors["purchase_step"] = "Purchase step must be greater than zero."
        if self.min_purchase is not None and self.min_purchase <= 0:
            errors["min_purchase"] = "Minimum purchase must be greater than zero."
        if None not in (self.min_purchase, self.max_purchase) and self.max_purchase < self.min_purchase:
            errors["max_purchase"] = "Maximum purchase must be at least the minimum purchase."
        if self.pack_size is not None and self.pack_size <= 0:
            errors["pack_size"] = "Pack size must be greater than zero."
        if errors:
            raise ValidationError(errors)

    @staticmethod
    def compute_combination_hash(pairs: list[tuple["Attribute", str]]) -> str:
        normalized = "|".join(f"{attribute.pk}:{value}" for attribute, value in sorted(pairs, key=lambda p: p[0].pk))
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()

    def set_attributes(self, pairs: list[tuple["Attribute", str]]) -> None:
        """Save the variant with new attribute records and combination_hash in one transaction.

        Works for unsaved variants too. ``pairs`` must already be validated against the product category.
        """
        from catalog.models import VariantAttribute

        combination_hash = self.compute_combination_hash(pairs)
        with transaction.atomic():
            siblings = ProductVariant.objects.filter(product_id=self.product_id, combination_hash=combination_hash)
            if self.pk is not None:
                siblings = siblings.exclude(pk=self.pk)
            if siblings.exists():
                raise ValidationError({"attributes": "Another variant of this product has the same combination."})
            self.combination_hash = combination_hash
            self.save()
            self.attributes.all().delete()
            VariantAttribute.objects.bulk_create(
                VariantAttribute(variant=self, attribute=attribute, value=value) for attribute, value in pairs
            )

    @classmethod
    def update_stock(
        cls, variant_id: int, *, quantity: Decimal | None = None, delta: Decimal | None = None
    ) -> "ProductVariant":
        """Set or adjust stock while holding a row lock (SELECT ... FOR UPDATE)."""
        with transaction.atomic():
            variant = cls.objects.select_for_update().get(pk=variant_id)
            new_quantity = quantity if quantity is not None else variant.stock_quantity + delta
            if new_quantity < 0:
                raise ValidationError({"stock_quantity": "Stock cannot be negative."})
            variant.stock_quantity = new_quantity
            variant.save(update_fields=["stock_quantity"])
        return variant

    @classmethod
    def adjust_prices(cls, percentage: Decimal, category_id: int | None = None) -> int:
        """Scale base and wholesale prices by ``percentage`` in one UPDATE; returns the number of variants.

        Results are rounded to the nearest ``PRICE_ROUNDING`` Toman (half away from zero).
        ``category_id`` limits the change to that category and its subcategories.
        """
        factor = 1 + percentage / 100
        variants = cls.objects.all()
        if category_id is not None:
            variants = variants.filter(Q(product__category_id=category_id) | Q(product__category__parent_id=category_id))
        return variants.update(
            base_price=Round(F("base_price") * factor / PRICE_ROUNDING) * PRICE_ROUNDING,
            wholesale_price=Round(F("wholesale_price") * factor / PRICE_ROUNDING) * PRICE_ROUNDING,
        )
