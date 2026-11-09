from rest_framework import serializers

from accounts.models import Permission


class AccessPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "label_fa", "module", "description_fa", "is_active"]
        read_only_fields = fields
