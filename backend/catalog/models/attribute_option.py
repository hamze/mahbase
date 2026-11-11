from django.core.exceptions import ValidationError
from django.db import models


class AttributeOption(models.Model):
    attribute = models.ForeignKey(
        "catalog.Attribute", on_delete=models.CASCADE, related_name="options"
    )
    value = models.CharField(max_length=200)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["attribute", "value"], name="uniq_attribute_option_value"),
        ]

    def __str__(self) -> str:
        return self.value

    def clean(self) -> None:
        if self.pk is None:
            return
        stored = AttributeOption.objects.get(pk=self.pk)
        if stored.value != self.value and stored.is_referenced():
            raise ValidationError({"value": "این گزینه در محصولات استفاده شده و قابل تغییر نام نیست."})

    def is_referenced(self) -> bool:
        return (
            self.attribute.product_values.filter(value=self.value).exists()
            or self.attribute.variant_values.filter(value=self.value).exists()
        )
