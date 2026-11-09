from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q

from catalog.models.product import sanitize_html

SINGLETON_ID = 1
SOCIAL_LINK_KEYS = ("instagram", "telegram", "whatsapp", "twitter", "linkedin", "youtube", "aparat")


class StoreSettings(models.Model):
    """Site-wide settings; exactly one row (id 1), created on first access by ``get_solo``.

    ``social_links`` is ``{<SOCIAL_LINK_KEYS>: url | null}`` and ``trust_badges`` is ``[{image_id, link_url}]``
    where each image is a TRUST_BADGE asset owned by this row (schemas validated by the API serializer).
    """

    class OutOfStockDisplay(models.TextChoices):
        SHOW_WITH_BADGE = "SHOW_WITH_BADGE"
        MOVE_TO_END = "MOVE_TO_END"

    id = models.PositiveSmallIntegerField(primary_key=True, default=SINGLETON_ID, editable=False)
    store_name = models.CharField(max_length=200)
    logo = models.ForeignKey("catalog.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    primary_color = models.CharField(
        max_length=7, default="#4f46e5", validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use a #RRGGBB color.")]
    )
    contact_phone = models.CharField(
        max_length=11, blank=True, validators=[RegexValidator(r"^0\d{10}$", "Use an 11-digit number starting with 0.")]
    )
    contact_email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    social_links = models.JSONField(default=dict, blank=True)
    trust_badges = models.JSONField(default=list, blank=True)
    default_profit_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("20"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    reviews_enabled = models.BooleanField(default=True)
    cod_enabled = models.BooleanField(default=False)
    out_of_stock_display = models.CharField(
        max_length=20, choices=OutOfStockDisplay.choices, default=OutOfStockDisplay.SHOW_WITH_BADGE
    )
    sms_notifications_enabled = models.BooleanField(default=False)
    footer_text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(name="store_settings_singleton", condition=Q(id=SINGLETON_ID)),
            models.CheckConstraint(
                name="store_settings_profit_0_100",
                condition=Q(default_profit_percentage__gte=0, default_profit_percentage__lte=100),
            ),
        ]

    def save(self, *args, **kwargs) -> None:
        self.footer_text = sanitize_html(self.footer_text)
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls) -> "StoreSettings":
        settings, _ = cls.objects.get_or_create(pk=SINGLETON_ID, defaults={"store_name": ""})
        return settings
