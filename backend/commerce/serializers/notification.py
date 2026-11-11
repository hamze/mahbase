from rest_framework import serializers

from commerce.models import Notification, Order


class NotificationSerializer(serializers.ModelSerializer):
    user_mobile = serializers.CharField(source="user.username", read_only=True, default=None)
    order_number = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id", "user", "user_mobile", "type", "title", "body", "status", "channel", "related_object_type",
            "related_object_id", "order_number", "created_at", "read_at",
        ]
        read_only_fields = fields

    def get_order_number(self, notification: Notification) -> str | None:
        """Order notifications link to the order page, which is addressed by order number."""
        if notification.related_object_type != "order":
            return None
        return Order.objects.filter(pk=notification.related_object_id).values_list("order_number", flat=True).first()


class NotificationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Notification.Status.choices)
