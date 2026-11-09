from django.db import models

from commerce.models.order import InvalidTransition


class ContactMessage(models.Model):
    """Public contact-form message. Status moves NEW → READ → REPLIED; REPLIED may reopen to READ with a note."""

    class Status(models.TextChoices):
        NEW = "NEW"
        READ = "READ"
        REPLIED = "REPLIED"

    TRANSITIONS = {
        Status.NEW: {Status.READ, Status.REPLIED},
        Status.READ: {Status.REPLIED},
        Status.REPLIED: {Status.READ},
    }

    name = models.CharField(max_length=200)
    mobile = models.CharField(max_length=11)
    email = models.EmailField(null=True, blank=True)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def set_status(self, status: str, note: str = "") -> None:
        if status not in self.TRANSITIONS[self.status]:
            raise InvalidTransition(f"A contact message cannot move from {self.status} to {status}.")
        if self.status == self.Status.REPLIED and not note:
            raise InvalidTransition("Reopening a replied message requires a note.")
        self.status = status
        if note:
            self.note = note
        self.save(update_fields=["status", "note"])
