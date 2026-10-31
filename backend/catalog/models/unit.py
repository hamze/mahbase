from django.db import models


class Unit(models.Model):
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        permissions = [("units_manage", "Can manage units")]

    def __str__(self) -> str:
        return self.name

    def is_referenced(self) -> bool:
        return self.products.exists()
