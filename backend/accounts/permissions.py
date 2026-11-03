from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class IsCustomer(BasePermission):
    """Customer self-service routes (own addresses, cart, orders): authenticated non-staff users."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        return bool(request.user and request.user.is_authenticated and not request.user.is_staff)


class IsCustomerOrGuest(BasePermission):
    """Cart routes: anonymous visitors (session cart) or customers; staff accounts have no cart."""

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        return not (request.user and request.user.is_authenticated and request.user.is_staff)
