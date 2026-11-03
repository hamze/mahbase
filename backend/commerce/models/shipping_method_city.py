from django.db import models


class ShippingMethodCity(models.Model):
    shipping_method = models.ForeignKey("commerce.ShippingMethod", on_delete=models.CASCADE, related_name="+")
    city = models.ForeignKey("commerce.City", on_delete=models.PROTECT, related_name="+")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["shipping_method", "city"], name="uniq_shipping_method_city")]
