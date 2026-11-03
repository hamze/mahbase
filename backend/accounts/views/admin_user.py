import logging

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.serializers import AdminUserSerializer, CustomerTierSerializer

logger = logging.getLogger(__name__)


class AdminUserViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """``/api/admin/users/`` — customers. Tier change, block, deactivate and reactivate have their own permissions;
    users are never deleted.
    """

    serializer_class = AdminUserSerializer
    rbac_permissions = {
        "list": "admin.users.view",
        "retrieve": "admin.users.view",
        "create": "admin.users.create",
        "update": "admin.users.edit",
        "partial_update": "admin.users.edit",
        "tier": "admin.users.tier",
        "block": "admin.users.block",
        "deactivate": "admin.users.block",
        "reactivate": "admin.users.block",
    }

    def get_queryset(self) -> QuerySet:
        users = User.objects.filter(profile__isnull=False).select_related("profile").order_by("-id")
        params = self.request.query_params
        if search := params.get("search"):
            users = users.filter(
                Q(username__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        if tier := params.get("customer_tier"):
            users = users.filter(profile__customer_tier=tier)
        if account_status := params.get("account_status"):
            users = users.filter(profile__account_status=account_status)
        return users

    @action(detail=True, methods=["patch"])
    def tier(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        serializer = CustomerTierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.profile.customer_tier = serializer.validated_data["customer_tier"]
        user.profile.save(update_fields=["customer_tier", "updated_at"])
        logger.info(f"User {request.user.pk} set tier of user {user.pk} to {user.profile.customer_tier}")
        return Response(self.get_serializer(user).data)

    def _change_state(self, request: Request, change: str) -> Response:
        user = self.get_object()
        getattr(user.profile, change)()
        logger.info(f"User {request.user.pk} applied {change} to user {user.pk}")
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"])
    def block(self, request: Request, pk: str) -> Response:
        return self._change_state(request, "block")

    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, pk: str) -> Response:
        return self._change_state(request, "deactivate")

    @action(detail=True, methods=["post"])
    def reactivate(self, request: Request, pk: str) -> Response:
        return self._change_state(request, "reactivate")
