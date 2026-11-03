from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models


class AuditLog(models.Model):
    """Admin decisions and sensitive changes (stock below reservation, approvals, status changes)."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=50)
    data = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        indexes = [models.Index(fields=["target_type", "target_id"], name="audit_target_idx")]
        permissions = [("admin_audit_view", "Can view the audit log")]

    @classmethod
    def record(cls, actor: object, action: str, target: models.Model, **data: object) -> "AuditLog":
        return cls.objects.create(
            actor=actor, action=action, target_type=target._meta.model_name, target_id=str(target.pk), data=data
        )
