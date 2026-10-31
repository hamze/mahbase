from django.db import models


class ProductAttributeValue(models.Model):
    """Descriptive (non variant-generating) attribute value of a product."""

    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="attribute_values")
    attribute = models.ForeignKey("catalog.Attribute", on_delete=models.PROTECT, related_name="product_values")
    value = models.CharField(max_length=255)

    class Meta:
        ordering = ["attribute_id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "attribute"], name="uniq_product_attribute_value"),
        ]

    def __str__(self) -> str:
        return f"{self.attribute}: {self.value}"
