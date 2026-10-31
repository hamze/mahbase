from django.db import models


class VariantAttribute(models.Model):
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.CASCADE, related_name="attributes")
    attribute = models.ForeignKey("catalog.Attribute", on_delete=models.PROTECT, related_name="variant_values")
    value = models.CharField(max_length=255)

    class Meta:
        ordering = ["attribute_id"]
        constraints = [
            models.UniqueConstraint(fields=["variant", "attribute"], name="uniq_variant_attribute"),
        ]

    def __str__(self) -> str:
        return f"{self.attribute}: {self.value}"
