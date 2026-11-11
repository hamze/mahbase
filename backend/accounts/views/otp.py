from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import OTPCode, UserProfile
from accounts.serializers import MobileSerializer, OTPVerifySerializer
from accounts.services.otp_delivery import SmsDeliveryFailed, send_code
from accounts.throttles import OTPIPThrottle
from accounts.tokens import PermissionRefreshToken
from config.api import Responses


def code_sent_response(mobile: str, purpose: str) -> Response:
    """Send a code; 202 with its lifetime and the resend wait, 502 when the SMS provider failed."""
    try:
        send_code(mobile, purpose)
    except SmsDeliveryFailed:
        return Responses.get_response(Responses.ACCOUNT_GENERAL.SMS_SEND_FAILED)
    return Response(
        {"expires_in": settings.OTP_TTL_SECONDS, "resend_in": settings.OTP_RESEND_SECONDS},
        status=status.HTTP_202_ACCEPTED,
    )


class OTPRequestView(APIView):
    """``POST /api/auth/otp/request/`` — send a login code to a mobile (customers sign up on first verify)."""

    permission_classes = [AllowAny]
    throttle_classes = [OTPIPThrottle]

    def post(self, request: Request) -> Response:
        serializer = MobileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return code_sent_response(serializer.validated_data["mobile"], OTPCode.Purpose.LOGIN)


class OTPVerifyView(APIView):
    """``POST /api/auth/otp/verify/`` — consume the code, create the customer on first login, issue JWTs.

    Sends Django's ``user_logged_in`` so the guest session cart is merged into the database cart.
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mobile, code = serializer.validated_data["mobile"], serializer.validated_data["code"]
        if not OTPCode.verify(mobile, OTPCode.Purpose.LOGIN, code):
            return Responses.get_response(Responses.ACCOUNT_GENERAL.INVALID_OTP)
        user = User.objects.filter(username=mobile).first()
        if user is None:
            user = UserProfile.create_customer(mobile, UserProfile.CreatedSource.SELF_SIGNUP)
        if not user.is_active:
            return Responses.get_response(Responses.ACCOUNT_GENERAL.DISABLED)
        refresh = PermissionRefreshToken.for_user(user)
        user_logged_in.send(sender=User, request=request._request, user=user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})
