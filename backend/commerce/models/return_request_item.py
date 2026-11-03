from django.db import models
from django.db.models import Q

from catalog.models.product_variant import QUANTITY


class ReturnRequestItem(models.Model):
    """Quantity of one order line being returned; ``resaleable`` is decided when the goods are received."""

    return_request = models.ForeignKey("commerce.ReturnRequest", on_delete=models.CASCADE, related_name="items")
    order_item = models.ForeignKey("commerce.OrderItem", on_delete=models.PROTECT, related_name="return_items")
    quantity = models.DecimalField(**QUANTITY)
    resaleable = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        constraints = [models.CheckConstraint(name="return_item_quantity_positive", condition=Q(quantity__gt=0))]
