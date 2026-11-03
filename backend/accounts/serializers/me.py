from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.models import UserProfile
from catalog.permissions import RBAC_PERMISSIONS, has_rbac_permission


class MeSerializer(serializers.ModelSerializer):
    """Current user; ``customer_tier``, ``is_staff`` and RBAC names let the frontend gate its controls."""

    customer_tier = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "is_staff", "customer_tier", "permissions"]
        read_only_fields = ["id", "username", "is_staff"]

    def get_customer_tier(self, user: User) -> str | None:
        profile = getattr(user, "profile", None)
        return profile.customer_tier if profile else None

    def get_permissions(self, user: User) -> list[str]:
        return [name for name in RBAC_PERMISSIONS if has_rbac_permission(user, name)]
