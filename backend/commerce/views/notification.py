from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import Notification
from commerce.serializers import NotificationSerializer, NotificationStatusSerializer


class AdminNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """``/api/notifications/?type=&status=&user=&date_from=&date_to=`` (``notifications.view``);
    ARCHIVED is hidden unless asked for. ``status`` (PATCH) needs ``notifications.manage``.
    """

    serializer_class = NotificationSerializer
    rbac_permissions = {
        "list": "notifications.view", "retrieve": "notifications.view", "status": "notifications.manage",
    }

    def get_queryset(self) -> QuerySet:
        notifications = Notification.objects.select_related("user")
        params = self.request.query_params
        if self.action == "list":
            if notification_status := params.get("status"):
                notifications = notifications.filter(status=notification_status)
            else:
                notifications = notifications.exclude(status=Notification.Status.ARCHIVED)
        if notification_type := params.get("type"):
            notifications = notifications.filter(type=notification_type)
        if user := params.get("user"):
            notifications = notifications.filter(user_id=user)
        if date_from := params.get("date_from"):
            notifications = notifications.filter(created_at__date__gte=date_from)
        if date_to := params.get("date_to"):
            notifications = notifications.filter(created_at__date__lte=date_to)
        return notifications

    @action(detail=True, methods=["patch"])
    def status(self, request: Request, pk: str) -> Response:
        notification = self.get_object()
        serializer = NotificationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification.set_status(serializer.validated_data["status"])
        return Response(self.get_serializer(notification).data)


class MyNotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """``/api/me/notifications/`` — only the requesting user's own, non-archived notifications."""

    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self) -> QuerySet:
        return Notification.objects.filter(user=self.request.user, channel=Notification.Channel.IN_APP).exclude(
            status=Notification.Status.ARCHIVED
        )

    @action(detail=True, methods=["patch"])
    def read(self, request: Request, pk: str) -> Response:
        notification = self.get_object()
        if notification.status == Notification.Status.NEW:
            notification.set_status(Notification.Status.READ)
        return Response(self.get_serializer(notification).data)
