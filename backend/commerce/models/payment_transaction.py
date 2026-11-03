from django.db import models
from django.db.models import Q

from catalog.models.product_variant import PRICE


class PaymentTransaction(models.Model):
    """One gateway callback result. Rows are only inserted, so ``amount`` and ``currency`` never change."""

    class Status(models.TextChoices):
        INITIATED = "INITIATED"
        PENDING = "PENDING"
        SUCCESS = "SUCCESS"
        FAILED = "FAILED"
        REFUNDED = "REFUNDED"
        PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"
        REJECTED_AFTER_RELEASE = "REJECTED_AFTER_RELEASE"
        SUCCESS_BUT_REJECTED = "SUCCESS_BUT_REJECTED"
        DUPLICATE_REJECTED = "DUPLICATE_REJECTED"

    order = models.ForeignKey("commerce.Order", on_delete=models.PROTECT, related_name="payments")
    idempotency_key = models.CharField(max_length=100, unique=True)
    gateway = models.CharField(max_length=50)
    gateway_transaction_id = models.CharField(max_length=100, null=True, blank=True)
    amount = models.DecimalField(**PRICE)
    currency = models.CharField(max_length=3, default="IRT")
    method = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=25, choices=Status.choices)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["gateway", "gateway_transaction_id"],
                condition=Q(gateway_transaction_id__isnull=False),
                name="uniq_gateway_transaction",
            ),
        ]

