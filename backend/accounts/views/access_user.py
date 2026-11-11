import logging

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import GroupMembership
from accounts.serializers import AccessUserGroupSerializer, AccessUserSerializer

logger = logging.getLogger(__name__)


class AccessUserViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """``/api/access/users/`` — staff accounts, their group and activation (``access.manage_users``).
    Passwords are managed elsewhere; only a superuser may (de)activate a superuser.
    """

    serializer_class = AccessUserSerializer
    rbac_permissions = {
        "list": "access.manage_users", "group": "access.manage_users", "toggle_active": "access.manage_users",
    }

    def get_queryset(self) -> QuerySet:
        users = User.objects.filter(is_staff=True).select_related("group_membership__group").order_by("id")
        params = self.request.query_params
        if search := params.get("search"):
            users = users.filter(
                Q(username__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        if group := params.get("group"):
            users = users.filter(group_membership__group_id=group)
        return users

    @action(detail=True, methods=["patch"])
    def group(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        serializer = AccessUserGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.validated_data["group"]
        GroupMembership.assign(user, group)
        logger.info(f"User {request.user.pk} set group of user {user.pk} to {group.pk if group else None}")
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["patch"], url_path="toggle-active")
    def toggle_active(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            raise PermissionDenied("فقط مدیر ارشد می‌تواند وضعیت فعال بودن مدیر ارشد را تغییر دهد.")
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        logger.info(f"User {request.user.pk} set is_active={user.is_active} on user {user.pk}")
        return Response(self.get_serializer(user).data)
