from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.utils import timezone

from commerce.models.order import InvalidTransition
from catalog.models.product import sanitize_html


class ProductQuestion(models.Model):
    """Customer or admin question about a product. Public only when ANSWERED and ``is_public``."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        ANSWERED = "ANSWERED"
        REJECTED = "REJECTED"

    class CreatedByType(models.TextChoices):
        CUSTOMER = "CUSTOMER"
        ADMIN = "ADMIN"

    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="questions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="product_questions"
    )
    question_text = models.TextField()
    answer_text = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_by_type = models.CharField(max_length=10, choices=CreatedByType.choices)
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(
                name="question_answered_has_answer",
                condition=~Q(status="ANSWERED") | Q(answer_text__isnull=False, answered_at__isnull=False),
            ),
        ]
        permissions = [("admin_product_questions_answer", "Can answer and moderate product questions")]

    def save(self, *args, **kwargs) -> None:
        if self.answer_text is not None:
            self.answer_text = sanitize_html(self.answer_text)
        super().save(*args, **kwargs)

    def answer(self, admin: User, answer_text: str, is_public: bool) -> None:
        self.answer_text = answer_text
        self.status = self.Status.ANSWERED
        self.answered_by = admin
        self.answered_at = timezone.now()
        self.is_public = is_public
        self.save()

    def reject(self) -> None:
        if self.status == self.Status.ANSWERED:
            raise InvalidTransition("An answered question cannot be rejected; unpublish it instead.")
        self.status = self.Status.REJECTED
        self.is_public = False
        self.save(update_fields=["status", "is_public"])
