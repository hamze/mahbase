from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from catalog.models.product_variant import CENT, PRICE

if TYPE_CHECKING:
    from catalog.models import Product


class DiscountCode(models.Model):
    """Discount code without a redemption table: ``Order.coupon_consumed`` is the single source of usage truth.

    ``used_count`` and the per-user limit count orders with ``coupon_consumed=True`` (refunded orders that keep the
    code still count). A main category includes its subcategories; a subcategory only itself; none means all.
    """

    class ProductDiscountType(models.TextChoices):
        NONE = "NONE"
        FIXED_AMOUNT = "FIXED_AMOUNT"
        PERCENTAGE = "PERCENTAGE"

    code = models.CharField(max_length=50, unique=True)
    product_discount_type = models.CharField(
        max_length=15, choices=ProductDiscountType.choices, default=ProductDiscountType.NONE
    )
    amount = models.DecimalField(**PRICE, default=Decimal("0"))
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    max_discount_amount = models.DecimalField(**PRICE, null=True, blank=True)
    free_shipping = models.BooleanField(default=False)
    category = models.ForeignKey(
        "catalog.Category", null=True, blank=True, on_delete=models.PROTECT, related_name="discount_codes"
    )
    min_eligible_subtotal = models.DecimalField(**PRICE, default=Decimal("0"))
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    usage_limit_total = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    per_user_limit = models.PositiveIntegerField(default=1)
    specific_mobile = models.CharField(max_length=11, blank=True)
    is_active = models.BooleanField(default=True)
    release_on_refund = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(name="discount_amount_non_negative", condition=Q(amount__gte=0)),
            models.CheckConstraint(
                name="discount_percentage_range",
                condition=Q(percentage__isnull=True) | Q(percentage__gt=0, percentage__lte=100),
            ),
        ]
        permissions = [("admin_discounts_manage", "Can manage discount codes")]

    def __str__(self) -> str:
        return self.code

    def clean(self) -> None:
        errors = {}
        if self.product_discount_type == self.ProductDiscountType.FIXED_AMOUNT and not self.amount:
            errors["amount"] = "تخفیف مبلغ ثابت نیاز به مبلغ دارد."
        if self.product_discount_type == self.ProductDiscountType.PERCENTAGE and not self.percentage:
            errors["percentage"] = "تخفیف درصدی نیاز به درصد دارد."
        if self.product_discount_type == self.ProductDiscountType.NONE and not self.free_shipping:
            errors["product_discount_type"] = "کد بدون تخفیف کالا باید ارسال رایگان داشته باشد."
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            errors["ends_at"] = "زمان پایان باید بعد از زمان شروع باشد."
        if errors:
            raise ValidationError(errors)

    def is_eligible(self, product: "Product") -> bool:
        return self.category_id is None or self.category_id in (product.category_id, product.category.parent_id)

    def evaluate(self, user: User, lines: list[tuple["Product", Decimal]], shipping_cost: Decimal) -> tuple[Decimal, Decimal]:
        """(discount amount, shipping discount) for priced lines ``(product, line_total)``; raises ValidationError.

        Never changes state; the caller locks the code when the result is applied to an order.
        """
        from commerce.models import Order

        now = timezone.now()
        errors = []
        if not self.is_active or now < self.starts_at or (self.ends_at and now >= self.ends_at):
            errors.append("این کد تخفیف فعال نیست.")
        if self.usage_limit_total is not None and self.used_count >= self.usage_limit_total:
            errors.append("ظرفیت استفاده از این کد تخفیف تمام شده است.")
        if self.specific_mobile and self.specific_mobile != user.get_username():
            errors.append("این کد تخفیف برای حساب شما معتبر نیست.")
        used_by_user = Order.objects.filter(user=user, discount_code=self, coupon_consumed=True).count()
        if used_by_user >= self.per_user_limit:
            errors.append("شما قبلا از این کد تخفیف استفاده کرده‌اید.")
        eligible = sum((total for product, total in lines if self.is_eligible(product)), Decimal("0"))
        if eligible == 0 or eligible < self.min_eligible_subtotal:
            errors.append("جمع خرید مشمول کمتر از حداقل مبلغ این کد است.")
        if errors:
            raise ValidationError({"discount_code": errors})

        discount = Decimal("0")
        if self.product_discount_type == self.ProductDiscountType.FIXED_AMOUNT:
            discount = min(self.amount, eligible)
        elif self.product_discount_type == self.ProductDiscountType.PERCENTAGE:
            discount = (eligible * self.percentage / 100).quantize(CENT, rounding=ROUND_HALF_UP)
            if self.max_discount_amount is not None:
                discount = min(discount, self.max_discount_amount)
            discount = min(discount, eligible)
        shipping_discount = shipping_cost if self.free_shipping else Decimal("0")
        return discount, shipping_discount
