from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

# RBAC names from the catalog and user/order specifications, mapped to the app that defines them;
# each maps to the Django permission "<app>.<name with _>" (e.g. "admin.orders.cancel" → "commerce.admin_orders_cancel").
RBAC_PERMISSIONS = {
    "categories.manage": "catalog",
    "tags.manage": "catalog",
    "brands.manage": "catalog",
    "attributes.manage": "catalog",
    "units.manage": "catalog",
    "media.manage": "catalog",
    "products.create": "catalog",
    "products.edit": "catalog",
    "products.publish": "catalog",
    "products.delete": "catalog",
    "products.edit_price": "catalog",
    "products.edit_stock": "catalog",
    "admin.users.view": "accounts",
    "admin.users.create": "accounts",
    "admin.users.edit": "accounts",
    "admin.users.tier": "accounts",
    "admin.users.block": "accounts",
    "admin.orders.view_all": "commerce",
    "admin.orders.create": "commerce",
    "admin.orders.edit": "commerce",
    "admin.orders.status": "commerce",
    "admin.orders.cancel": "commerce",
    "admin.refunds.approve": "commerce",
    "admin.refunds.complete": "commerce",
    "admin.returns.approve": "commerce",
    "admin.returns.receive": "commerce",
    "admin.returns.complete": "commerce",
    "admin.discounts.manage": "commerce",
    "admin.shipping.manage": "commerce",
    "admin.faqs.manage": "commerce",
    "admin.product_questions.answer": "commerce",
    "admin.audit.view": "commerce",
}


def django_permission(rbac_name: str) -> str:
    return f"{RBAC_PERMISSIONS[rbac_name]}.{rbac_name.replace('.', '_')}"


def has_rbac_permission(user: object, rbac_name: str) -> bool:
    return user.has_perm(django_permission(rbac_name))


class RBACPermission(BasePermission):
    """Staff-only API access; actions listed in ``view.rbac_permissions`` also need that RBAC permission."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        required = getattr(view, "rbac_permissions", {}).get(getattr(view, "action", None))
        return required is None or has_rbac_permission(request.user, required)
