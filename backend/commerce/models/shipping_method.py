from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, QuerySet

from catalog.models.product_variant import PRICE


class ShippingMethod(models.Model):
    """Delivery option; limited to ``cities`` unless ``applies_to_all_cities``. Deactivated, never deleted once used."""

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    price = models.DecimalField(**PRICE, default=Decimal("0"))
    applies_to_all_cities = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    cities = models.ManyToManyField("commerce.City", through="commerce.ShippingMethodCity", related_name="+", blank=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [models.CheckConstraint(name="shipping_price_non_negative", condition=Q(price__gte=0))]
        permissions = [("admin_shipping_manage", "Can manage shipping methods")]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def available_for(cls, city_id: int) -> QuerySet:
        return cls.objects.filter(Q(applies_to_all_cities=True) | Q(cities=city_id), is_active=True).distinct()

    @staticmethod
    def validate_cities(applies_to_all_cities: bool, city_ids: list[int]) -> None:
        if not applies_to_all_cities and not city_ids:
            raise ValidationError({"cities": "حداقل یک شهر انتخاب کنید یا روش را برای همه شهرها فعال کنید."})
