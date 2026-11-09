from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

from accounts.models import Permission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


def has_permission(user: object, code: str) -> bool:
    """Superusers hold every code; inactive users and users without a group hold none."""
    if not user.is_active:
        return False
    if user.is_superuser:
        return True
    return Permission.objects.filter(code=code, is_active=True, groups__memberships__user_id=user.pk).exists()


def resolved_permissions(user: object) -> list[str]:
    """The flat code list exposed in ``/api/auth/me/`` and the JWT payload."""
    if not user.is_active:
        return []
    codes = Permission.objects.filter(is_active=True)
    if not user.is_superuser:
        codes = codes.filter(groups__memberships__user_id=user.pk)
    return list(codes.order_by("code").values_list("code", flat=True))


class IsCustomer(BasePermission):
    """Customer self-service routes (own addresses, cart, orders): authenticated non-staff users."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        return bool(request.user and request.user.is_authenticated and not request.user.is_staff)


class IsCustomerOrGuest(BasePermission):
    """Cart routes: anonymous visitors (session cart) or customers; staff accounts have no cart."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        return not (request.user and request.user.is_authenticated and request.user.is_staff)
