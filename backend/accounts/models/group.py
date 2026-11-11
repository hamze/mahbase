from django.core.exceptions import ValidationError
from django.db import models, transaction


class Group(models.Model):
    """Role template: users get permissions only through their single group. System groups cannot be deleted."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description_fa = models.TextField(null=True, blank=True)
    permissions = models.ManyToManyField("accounts.Permission", blank=True, related_name="groups")
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        if self.is_system:
            raise ValidationError("گروه‌های سیستمی قابل حذف نیستند.")
        return super().delete(*args, **kwargs)

    def replace_permissions(self, permissions: list) -> None:
        """The full permission set is replaced atomically; a partially applied set is never visible."""
        with transaction.atomic():
            self.permissions.set(permissions)
            self.save(update_fields=["updated_at"])
