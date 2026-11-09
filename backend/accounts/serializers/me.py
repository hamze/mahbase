from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.permissions import resolved_permissions


class MeSerializer(serializers.ModelSerializer):
    """Current user; ``customer_tier``, ``is_staff``, ``is_superuser`` and the resolved RBAC codes let the frontend
    gate its controls (the same values are in the JWT payload).
    """

    customer_tier = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "is_staff", "is_superuser", "customer_tier", "permissions",
        ]
        read_only_fields = ["id", "username", "is_staff", "is_superuser"]

    def get_customer_tier(self, user: User) -> str | None:
        profile = getattr(user, "profile", None)
        return profile.customer_tier if profile else None

    def get_permissions(self, user: User) -> list[str]:
        return resolved_permissions(user)
