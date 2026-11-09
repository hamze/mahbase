from rest_framework import serializers

from commerce.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    user_mobile = serializers.CharField(source="user.username", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            "id", "user", "user_mobile", "type", "title", "body", "status", "channel", "related_object_type",
            "related_object_id", "created_at", "read_at",
        ]
        read_only_fields = fields


class NotificationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Notification.Status.choices)
