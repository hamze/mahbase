from django.core.exceptions import ValidationError
from django.db import models


class Permission(models.Model):
    """Flat RBAC code (``<module>.<action>``) seeded from ``accounts.permission_codes``; ``code`` never changes."""

    code = models.CharField(max_length=100, unique=True)
    label_fa = models.CharField(max_length=200)
    module = models.CharField(max_length=50, db_index=True)
    description_fa = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code

    def save(self, *args, **kwargs) -> None:
        if self.pk and Permission.objects.filter(pk=self.pk).exclude(code=self.code).exists():
            raise ValidationError({"code": "A permission code cannot be changed."})
        super().save(*args, **kwargs)
