from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import ContactMessage
from commerce.serializers import ContactMessageSerializer, ContactMessageStatusSerializer
from commerce.throttles import ContactIPThrottle, ContactMobileHourThrottle, ContactMobileMinuteThrottle


class ContactMessageViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    """``POST /api/contact-messages/`` — public contact form, rate-limited per IP and mobile;
    ``GET`` (``contact_messages.view``) and ``PATCH {id}/status/`` (``contact_messages.manage``) for admins.
    """

    serializer_class = ContactMessageSerializer
    rbac_permissions = {
        "list": "contact_messages.view",
        "retrieve": "contact_messages.view",
        "status": "contact_messages.manage",
    }

    def get_permissions(self) -> list:
        return [AllowAny()] if self.action == "create" else super().get_permissions()

    def get_throttles(self) -> list:
        if self.action == "create":
            return [ContactIPThrottle(), ContactMobileMinuteThrottle(), ContactMobileHourThrottle()]
        return super().get_throttles()

    def get_queryset(self) -> QuerySet:
        messages = ContactMessage.objects.all()
        if message_status := self.request.query_params.get("status"):
            messages = messages.filter(status=message_status)
        return messages

    @action(detail=True, methods=["patch"])
    def status(self, request: Request, pk: str) -> Response:
        message = self.get_object()
        serializer = ContactMessageStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message.set_status(serializer.validated_data["status"], serializer.validated_data["note"])
        return Response(self.get_serializer(message).data)
