from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

# RBAC names from the catalog specification; each maps to the Django permission "catalog.<name with _>".
RBAC_PERMISSIONS = (
    "categories.manage",
    "tags.manage",
    "brands.manage",
    "attributes.manage",
    "units.manage",
    "media.manage",
    "products.create",
    "products.edit",
    "products.publish",
    "products.delete",
    "products.edit_price",
    "products.edit_stock",
)


def django_permission(rbac_name: str) -> str:
    return f"catalog.{rbac_name.replace('.', '_')}"


def has_rbac_permission(user: object, rbac_name: str) -> bool:
    return user.has_perm(django_permission(rbac_name))


class RBACPermission(BasePermission):
    """Staff-only API access; actions listed in ``view.rbac_permissions`` also need that RBAC permission."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        required = getattr(view, "rbac_permissions", {}).get(getattr(view, "action", None))
        return required is None or has_rbac_permission(request.user, required)
