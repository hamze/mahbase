from typing import TYPE_CHECKING

from django.db import models

if TYPE_CHECKING:
    from commerce.models import Address, Order


class OrderAddressSnapshot(models.Model):
    """Copy of the delivery address at confirmation; no link to ``Address`` so later edits never change orders."""

    order = models.OneToOneField("commerce.Order", on_delete=models.CASCADE, related_name="address_snapshot")
    receiver_name = models.CharField(max_length=150)
    receiver_mobile = models.CharField(max_length=11)
    province_name = models.CharField(max_length=100)
    city_name = models.CharField(max_length=100)
    address_line = models.TextField()
    postal_code = models.CharField(max_length=10)
    plaque = models.CharField(max_length=20, blank=True)
    unit = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    @classmethod
    def copy_from(cls, order: "Order", address: "Address") -> "OrderAddressSnapshot":
        return cls.objects.create(
            order=order,
            receiver_name=address.receiver_name,
            receiver_mobile=address.receiver_mobile,
            province_name=address.province.name,
            city_name=address.city.name,
            address_line=address.address_line,
            postal_code=address.postal_code,
            plaque=address.plaque,
            unit=address.unit,
            latitude=address.latitude,
            longitude=address.longitude,
        )
