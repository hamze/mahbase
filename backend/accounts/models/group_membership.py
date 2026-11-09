from django.conf import settings
from django.db import models


class GroupMembership(models.Model):
    """The user's one group (``auth.User`` cannot take a ``group`` column); no row means no group."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="group_membership"
    )
    group = models.ForeignKey("accounts.Group", on_delete=models.CASCADE, related_name="memberships")

    @classmethod
    def assign(cls, user: object, group: object | None) -> None:
        """Set or clear the user's group."""
        if group is None:
            cls.objects.filter(user=user).delete()
        else:
            cls.objects.update_or_create(user=user, defaults={"group": group})
