from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView


class OTPIPThrottle(SimpleRateThrottle):
    """Code requests (login, password reset, mobile change) per client IP (rate ``otp_ip``); the per-mobile limit
    is ``OTP_RESEND_SECONDS`` in ``OTPCode.issue``.
    """

    scope = "otp_ip"

    def get_cache_key(self, request: Request, view: APIView) -> str:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
