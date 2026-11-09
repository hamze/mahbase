from rest_framework import serializers

from accounts.models import Group, Permission


class AccessGroupSerializer(serializers.ModelSerializer):
    """``permissions`` is the full code list; an update replaces the whole set in one transaction."""

    permissions = serializers.SlugRelatedField(
        slug_field="code", many=True, required=False, queryset=Permission.objects.filter(is_active=True)
    )
    user_count = serializers.IntegerField(read_only=True)
    permission_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Group
        fields = [
            "id", "name", "slug", "description_fa", "permissions", "is_system", "user_count", "permission_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["is_system", "created_at", "updated_at"]

    def create(self, validated_data: dict) -> Group:
        permissions = validated_data.pop("permissions", [])
        group = Group.objects.create(**validated_data)
        group.replace_permissions(permissions)
        return group

    def update(self, group: Group, validated_data: dict) -> Group:
        permissions = validated_data.pop("permissions", None)
        for name, value in validated_data.items():
            setattr(group, name, value)
        group.save()
        if permissions is not None:
            group.replace_permissions(permissions)
        return group
