from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

from accounts.permissions import has_permission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class RBACPermission(BasePermission):
    """Staff-only API access; actions listed in ``view.rbac_permissions`` also need that RBAC code, or any one of
    a tuple of codes (``accounts.permissions.has_permission``: group codes, superuser bypass).
    """

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        required = getattr(view, "rbac_permissions", {}).get(getattr(view, "action", None))
        if required is None:
            return True
        codes = (required,) if isinstance(required, str) else required
        return any(has_permission(request.user, code) for code in codes)
