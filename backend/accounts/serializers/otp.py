from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import normalize_mobile


class MobileSerializer(serializers.Serializer):
    mobile = serializers.CharField(max_length=20)

    def validate_mobile(self, value: str) -> str:
        return normalize_mobile(value)


class OTPVerifySerializer(MobileSerializer):
    code = serializers.CharField(max_length=10)


class PasswordResetConfirmSerializer(OTPVerifySerializer):
    new_password = serializers.CharField(max_length=128, write_only=True)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value
