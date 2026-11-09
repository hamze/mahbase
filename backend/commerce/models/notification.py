from django.conf import settings
from django.db import models
from django.utils import timezone

from commerce.models.order import InvalidTransition


class Notification(models.Model):
    """In-app message log for a user (or system-wide when ``user`` is null). Status only moves forward
    (NEW → READ → ARCHIVED); archived records are hidden from default lists, never deleted.
    """

    class Type(models.TextChoices):
        SYSTEM = "SYSTEM"
        ORDER = "ORDER"
        REVIEW = "REVIEW"
        CONTACT = "CONTACT"
        ACCOUNT = "ACCOUNT"

    class Status(models.TextChoices):
        NEW = "NEW"
        READ = "READ"
        ARCHIVED = "ARCHIVED"

    class Channel(models.TextChoices):
        IN_APP = "IN_APP"
        SMS = "SMS"
        EMAIL = "EMAIL"

    STATUS_ORDER = [Status.NEW, Status.READ, Status.ARCHIVED]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    title = models.CharField(max_length=200)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.IN_APP)
    related_object_type = models.CharField(max_length=50, null=True, blank=True)
    related_object_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "status", "-created_at"], name="notification_inbox_idx")]

    def set_status(self, status: str) -> None:
        if self.STATUS_ORDER.index(status) < self.STATUS_ORDER.index(self.status):
            raise InvalidTransition(f"A notification cannot move from {self.status} back to {status}.")
        if self.read_at is None and status != self.Status.NEW:
            self.read_at = timezone.now()
        self.status = status
        self.save(update_fields=["status", "read_at"])
