from rest_framework import serializers

from accounts.models import normalize_mobile
from commerce.models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    """Public submission (creates NEW) and admin read."""

    class Meta:
        model = ContactMessage
        fields = ["id", "name", "mobile", "email", "subject", "message", "status", "note", "created_at"]
        read_only_fields = ["status", "note", "created_at"]

    def validate_mobile(self, value: str) -> str:
        return normalize_mobile(value)


class ContactMessageStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ContactMessage.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")
