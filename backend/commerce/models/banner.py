from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class Banner(models.Model):
    """Image banner for a site position, optionally limited to a time window (both ends inclusive)."""

    class Position(models.TextChoices):
        TOP_HEADER = "TOP_HEADER"
        HERO = "HERO"
        SIDEBAR = "SIDEBAR"

    title = models.CharField(max_length=200)
    image = models.ForeignKey("catalog.MediaAsset", on_delete=models.PROTECT, related_name="+")
    link_url = models.CharField(max_length=500, null=True, blank=True)
    position = models.CharField(max_length=15, choices=Position.choices)
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.CheckConstraint(
                name="banner_window_order",
                condition=Q(start_at__isnull=True) | Q(end_at__isnull=True) | Q(end_at__gt=F("start_at")),
            ),
        ]

    def __str__(self) -> str:
        return self.title

    def clean(self) -> None:
        if self.start_at and self.end_at and self.end_at <= self.start_at:
            raise ValidationError({"end_at": "The end must be after the start."})

    @classmethod
    def visible_at(cls, moment: datetime) -> models.QuerySet:
        return cls.objects.filter(
            Q(start_at__isnull=True) | Q(start_at__lte=moment),
            Q(end_at__isnull=True) | Q(end_at__gte=moment),
            is_active=True,
        ).order_by("sort_order", "id")
