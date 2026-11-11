import hashlib
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Q
from django.db.models.functions import Round

if TYPE_CHECKING:
    from catalog.models import Attribute

QUANTITY = {"max_digits": 12, "decimal_places": 3}
# Catalog and order money share this type (Toman); order snapshots copy the decimal value as is.
PRICE = {"max_digits": 18, "decimal_places": 2}
CENT = Decimal("0.01")
# Prices are in Toman; bulk adjustments round to whole thousands.
PRICE_ROUNDING = Decimal("1000")


class StockBelowReserved(Exception):
    """A stock change would leave less stock than is reserved by unpaid orders and was not confirmed."""

    def __init__(self, variant: "ProductVariant", requested: Decimal) -> None:
        super().__init__(f"Stock {requested} is below the reserved quantity of variant {variant.pk}.")
        self.variant = variant
        self.requested = requested
        self.shortfall = variant.reserved_quantity - requested


class ProductVariant(models.Model):
    """Purchasable item. All quantities are in the product's purchasable unit.

    ``reserved_quantity`` is held by orders whose ``stock_reservation_status`` is RESERVED;
    ``available_quantity = stock_quantity - reserved_quantity``.
    """

    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="variants")
    sku = models.CharField(max_length=100, unique=True)
    combination_hash = models.CharField(max_length=32)
    stock_quantity = models.DecimalField(**QUANTITY, default=Decimal("0"))
    reserved_quantity = models.DecimalField(**QUANTITY, default=Decimal("0"))
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
            models.CheckConstraint(name="variant_reserved_non_negative", condition=Q(reserved_quantity__gte=0)),
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
            errors["stock_quantity"] = "موجودی نمی‌تواند منفی باشد."
        if self.purchase_step is not None and self.purchase_step <= 0:
            errors["purchase_step"] = "گام خرید باید بزرگتر از صفر باشد."
        if self.min_purchase is not None and self.min_purchase <= 0:
            errors["min_purchase"] = "حداقل خرید باید بزرگتر از صفر باشد."
        if None not in (self.min_purchase, self.max_purchase) and self.max_purchase < self.min_purchase:
            errors["max_purchase"] = "حداکثر خرید باید حداقل برابر حداقل خرید باشد."
        if self.pack_size is not None and self.pack_size <= 0:
            errors["pack_size"] = "اندازه بسته باید بزرگتر از صفر باشد."
        if errors:
            raise ValidationError(errors)

    @property
    def available_quantity(self) -> Decimal:
        return self.stock_quantity - self.reserved_quantity

    def is_sellable(self) -> bool:
        return self.product.is_published and self.product.deleted_at is None

    def purchase_errors(self, quantity: Decimal) -> list[str]:
        """Purchase rules for one cart/order line (step, min/max, availability); empty when the line is valid."""
        errors = []
        if not self.is_sellable():
            errors.append("این محصول برای فروش در دسترس نیست.")
        if quantity <= 0:
            errors.append("مقدار باید بزرگتر از صفر باشد.")
        elif quantity % self.purchase_step != 0:
            errors.append(f"مقدار باید مضربی از {self.purchase_step.normalize()} باشد.")
        if quantity < self.min_purchase or quantity > self.max_purchase:
            errors.append(
                f"مقدار باید بین {self.min_purchase.normalize()} و {self.max_purchase.normalize()} باشد."
            )
        if quantity > self.available_quantity:
            errors.append("موجودی کافی نیست.")
        return errors

    def clamp_quantity(self, quantity: Decimal) -> Decimal | None:
        """Largest valid quantity not above ``quantity``, ``max_purchase`` or availability; None when below minimum."""
        limit = min(quantity, self.max_purchase, self.available_quantity)
        steps = (limit / self.purchase_step).to_integral_value(rounding=ROUND_DOWN)
        clamped = steps * self.purchase_step
        return clamped if clamped >= self.min_purchase and clamped > 0 else None

    def price_for(self, customer_tier: str) -> tuple[Decimal, Decimal]:
        """(original unit price, product discount per unit) for a tier.

        Wholesale customers get ``wholesale_price`` when set, otherwise ``base_price``; the discount applies only
        while ``is_discount_active``.
        """
        original = self.base_price
        if customer_tier == "WHOLESALE" and self.wholesale_price is not None:
            original = self.wholesale_price
        discount = Decimal("0")
        if self.is_discount_active and self.discount_percentage:
            discount = (original * self.discount_percentage / 100).quantize(CENT, rounding=ROUND_HALF_UP)
        return original, discount

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
                raise ValidationError({"attributes": "تنوع دیگری از این محصول همین ترکیب را دارد."})
            self.combination_hash = combination_hash
            self.save()
            self.attributes.all().delete()
            VariantAttribute.objects.bulk_create(
                VariantAttribute(variant=self, attribute=attribute, value=value) for attribute, value in pairs
            )

    @classmethod
    def update_stock(
        cls,
        variant_id: int,
        *,
        quantity: Decimal | None = None,
        delta: Decimal | None = None,
        allow_below_reserved: bool = False,
    ) -> "ProductVariant":
        """Set or adjust stock while holding a row lock (SELECT ... FOR UPDATE).

        Stock below ``reserved_quantity`` raises ``StockBelowReserved`` unless ``allow_below_reserved``
        (the caller then invalidates the affected reserved orders in the same transaction).
        """
        with transaction.atomic():
            variant = cls.objects.select_for_update().get(pk=variant_id)
            new_quantity = quantity if quantity is not None else variant.stock_quantity + delta
            if new_quantity < 0:
                raise ValidationError({"stock_quantity": "موجودی نمی‌تواند منفی باشد."})
            if new_quantity < variant.reserved_quantity and not allow_below_reserved:
                raise StockBelowReserved(variant, new_quantity)
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
