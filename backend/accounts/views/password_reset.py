from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import OTPCode
from accounts.serializers import MobileSerializer, PasswordResetConfirmSerializer
from accounts.services.otp_delivery import SmsDeliveryFailed, send_code
from accounts.throttles import OTPIPThrottle
from config.api import Responses


class PasswordResetRequestView(APIView):
    """``POST /api/auth/password/reset/request/`` — same response whether or not the account exists."""

    permission_classes = [AllowAny]
    throttle_classes = [OTPIPThrottle]

    def post(self, request: Request) -> Response:
        serializer = MobileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mobile = serializer.validated_data["mobile"]
        if User.objects.filter(username=mobile, is_active=True).exists():
            try:
                send_code(mobile, OTPCode.Purpose.RESET_PASSWORD)
            except SmsDeliveryFailed:
                return Responses.get_response(Responses.ACCOUNT_GENERAL.SMS_SEND_FAILED)
        return Response(status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
    """``POST /api/auth/password/reset/confirm/`` — set a new password with a valid reset code."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not OTPCode.verify(data["mobile"], OTPCode.Purpose.RESET_PASSWORD, data["code"]):
            return Responses.get_response(Responses.ACCOUNT_GENERAL.INVALID_OTP)
        user = User.objects.get(username=data["mobile"])
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Responses.get_response(Responses.ACCOUNT_GENERAL.PASSWORD_CHANGED)
