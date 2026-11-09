from typing import TYPE_CHECKING

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from commerce.models import StoreSettings

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class ReviewsEnabled(BasePermission):
    """``StoreSettings.reviews_enabled`` gates both showing and submitting product reviews.

    Raises instead of returning False so anonymous visitors get 403 (disabled), not DRF's 401 (log in).
    """

    def has_permission(self, request: "Request", view: "APIView") -> bool:
        if not StoreSettings.get_solo().reviews_enabled:
            raise PermissionDenied("Product reviews are disabled.")
        return True
