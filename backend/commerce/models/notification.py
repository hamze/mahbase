from django.conf import settings
from django.db import models, transaction
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

    @classmethod
    def notify(
        cls,
        user: object,
        type: str,
        title: str,
        body: str,
        *,
        related: tuple[str, int] | None = None,
        sms: tuple[str, list[str]] | None = None,
    ) -> "Notification":
        """Create the in-app notification (always) and, when ``StoreSettings.sms_notifications_enabled`` and an
        ``sms`` (template, tokens) is given, an SMS record sent after the surrounding transaction commits.
        """
        from commerce.models import StoreSettings
        from commerce.tasks import send_sms_task

        related_type, related_id = related or (None, None)
        common = {"user": user, "type": type, "title": title, "body": body, "related_object_type": related_type,
                  "related_object_id": related_id}
        notification = cls.objects.create(channel=cls.Channel.IN_APP, **common)
        if sms is not None and StoreSettings.get_solo().sms_notifications_enabled:
            template, tokens = sms
            # The SMS record is the admin's delivery log; customers only see in-app notifications.
            cls.objects.create(channel=cls.Channel.SMS, status=cls.Status.READ, **common)
            mobile = user.get_username()
            transaction.on_commit(lambda: send_sms_task.delay(mobile, template, tokens))
        return notification

    def set_status(self, status: str) -> None:
        if self.STATUS_ORDER.index(status) < self.STATUS_ORDER.index(self.status):
            raise InvalidTransition(f"وضعیت اعلان از {self.status} به {status} قابل بازگشت نیست.")
        if self.read_at is None and status != self.Status.NEW:
            self.read_at = timezone.now()
        self.status = status
        self.save(update_fields=["status", "read_at"])
