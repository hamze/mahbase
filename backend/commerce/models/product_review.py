from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from commerce.models.notification import Notification
from commerce.models.order import Order

# The only place that decides which orders prove a purchase for a review.
REVIEW_ELIGIBLE_ORDER_STATUSES = [Order.Status.DELIVERED]
REVIEW_BODY_MAX_LENGTH = 2000


class ProductReview(models.Model):
    """Verified-purchase review: one per user and product, shown only after approval."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"

    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_reviews")
    # Null only for legacy rows; ``submit`` always sets it.
    order = models.ForeignKey(
        "commerce.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="product_reviews"
    )
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=200, null=True, blank=True)
    body = models.TextField(max_length=REVIEW_BODY_MAX_LENGTH)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="review_one_per_user_product"),
            models.CheckConstraint(name="review_rating_1_to_5", condition=Q(rating__gte=1, rating__lte=5)),
        ]

    @classmethod
    def submit(cls, user: User, product: object, *, rating: int, title: str | None, body: str) -> "ProductReview":
        """Create a PENDING review. Eligibility is re-checked with the proving order locked, so a concurrent
        status change (e.g. a return completing) cannot interleave between the check and the insert.
        """
        with transaction.atomic():
            order = (
                Order.objects.select_for_update(of=("self",))
                .filter(user=user, order_status__in=REVIEW_ELIGIBLE_ORDER_STATUSES, items__product=product)
                .order_by("-id")
                .first()
            )
            if order is None:
                raise ValidationError("Only customers with a delivered order of this product can review it.")
            return cls.objects.create(product=product, user=user, order=order, rating=rating, title=title, body=body)

    def approve(self, moderator: User) -> None:
        self._moderate(moderator, self.Status.APPROVED, None)

    def reject(self, moderator: User, reason: str) -> None:
        self._moderate(moderator, self.Status.REJECTED, reason)

    def _moderate(self, moderator: User, status: str, reason: str | None) -> None:
        with transaction.atomic():
            self.status = status
            self.reject_reason = reason
            self.moderated_by = moderator
            self.moderated_at = timezone.now()
            self.save(update_fields=["status", "reject_reason", "moderated_by", "moderated_at", "updated_at"])
            Notification.objects.create(
                user=self.user,
                type=Notification.Type.REVIEW,
                title="نظر شما تأیید شد" if status == self.Status.APPROVED else "نظر شما رد شد",
                body=reason or self.product.name,
                related_object_type="review",
                related_object_id=self.pk,
            )
