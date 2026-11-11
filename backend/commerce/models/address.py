from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone


class AddressQuerySet(QuerySet):
    def active(self) -> "AddressQuerySet":
        return self.filter(deleted_at__isnull=True)


class Address(models.Model):
    """Customer address. Soft delete only; orders copy it into ``OrderAddressSnapshot``."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="addresses")
    title = models.CharField(max_length=100)
    receiver_name = models.CharField(max_length=150)
    receiver_mobile = models.CharField(max_length=11)
    province = models.ForeignKey("commerce.Province", on_delete=models.PROTECT, related_name="+")
    city = models.ForeignKey("commerce.City", on_delete=models.PROTECT, related_name="+")
    address_line = models.TextField()
    postal_code = models.CharField(max_length=10)
    plaque = models.CharField(max_length=20, blank=True)
    unit = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AddressQuerySet.as_manager()

    class Meta:
        ordering = ["-is_default", "-id"]
        verbose_name_plural = "addresses"
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(is_default=True, deleted_at__isnull=True),
                name="uniq_active_default_address",
            ),
            models.CheckConstraint(
                name="address_coordinates_together",
                condition=Q(latitude__isnull=True, longitude__isnull=True)
                | Q(latitude__isnull=False, longitude__isnull=False),
            ),
        ]

    def __str__(self) -> str:
        return self.title

    def clean(self) -> None:
        errors = {}
        if self.city_id and self.province_id and self.city.province_id != self.province_id:
            errors["city"] = "شهر انتخاب‌شده متعلق به استان انتخاب‌شده نیست."
        if (self.latitude is None) != (self.longitude is None):
            errors["latitude"] = "عرض و طول جغرافیایی باید با هم وارد شوند."
        if errors:
            raise ValidationError(errors)

    def make_default(self) -> None:
        with transaction.atomic():
            Address.objects.active().filter(user_id=self.user_id, is_default=True).exclude(pk=self.pk).update(
                is_default=False
            )
            self.is_default = True
            self.save(update_fields=["is_default", "updated_at"])

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.is_default = False
        self.save(update_fields=["deleted_at", "is_default", "updated_at"])
