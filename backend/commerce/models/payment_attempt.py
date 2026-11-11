from django.db import models

from catalog.models.product_variant import PRICE


class PaymentAttempt(models.Model):
    """One trip to the bank: the bank's ``authority`` token for a payment request of ``amount``.

    The return from the bank names only the authority, so this row maps it back to the order and the requested
    amount the verification must confirm. Retrying payment creates a new attempt.
    """

    order = models.ForeignKey("commerce.Order", on_delete=models.PROTECT, related_name="payment_attempts")
    gateway = models.CharField(max_length=50)
    authority = models.CharField(max_length=100)
    amount = models.DecimalField(**PRICE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["gateway", "authority"], name="uniq_payment_attempt_authority"),
        ]
