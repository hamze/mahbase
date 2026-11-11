from rest_framework import serializers

from accounts.models import normalize_mobile


class MobileChangeRequestSerializer(serializers.Serializer):
    new_mobile = serializers.CharField(max_length=20)

    def validate_new_mobile(self, value: str) -> str:
        return normalize_mobile(value)


class MobileChangeConfirmSerializer(MobileChangeRequestSerializer):
    old_code = serializers.CharField(max_length=10)
    new_code = serializers.CharField(max_length=10)
