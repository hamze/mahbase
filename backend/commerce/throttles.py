from django.core.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from accounts.models import normalize_mobile


class ContactIPThrottle(SimpleRateThrottle):
    """Contact-form submissions per client IP (rate ``contact_ip``)."""

    scope = "contact_ip"

    def get_cache_key(self, request: Request, view: APIView) -> str:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ContactMobileHourThrottle(SimpleRateThrottle):
    """Contact-form submissions per normalized mobile (rate ``contact_mobile_hour``); an invalid mobile is not
    counted because the serializer rejects it.
    """

    scope = "contact_mobile_hour"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        try:
            mobile = normalize_mobile(str(request.data.get("mobile", "")))
        except ValidationError:
            return None
        return self.cache_format % {"scope": self.scope, "ident": mobile}


class ContactMobileMinuteThrottle(ContactMobileHourThrottle):
    scope = "contact_mobile_minute"
