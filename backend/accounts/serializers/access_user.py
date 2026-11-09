from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.models import Group
from accounts.models.user_profile import MOBILE_PATTERN


class AccessUserSerializer(serializers.ModelSerializer):
    """Staff account with its group; read-only here (group and activation have their own endpoints)."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    mobile = serializers.SerializerMethodField()
    group = serializers.IntegerField(source="group_membership.group_id", read_only=True, default=None)
    group_name = serializers.CharField(source="group_membership.group.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "mobile", "group", "group_name", "is_active", "is_superuser"]
        read_only_fields = fields

    def get_mobile(self, user: User) -> str | None:
        return user.username if MOBILE_PATTERN.match(user.username) else None


class AccessUserGroupSerializer(serializers.Serializer):
    group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), allow_null=True)
