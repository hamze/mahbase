from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.permissions import RBAC_PERMISSIONS, has_rbac_permission


class MeView(APIView):
    """Current user and RBAC permission names, used by the admin UI for rendering only."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user
        return Response({
            "id": user.pk,
            "username": user.get_username(),
            "is_staff": user.is_staff,
            "permissions": [name for name in RBAC_PERMISSIONS if has_rbac_permission(user, name)],
        })
