from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import OTPCode
from accounts.serializers import MobileSerializer, PasswordResetConfirmSerializer
from accounts.services.sms.provider import get_sms_sender


class PasswordResetRequestView(APIView):
    """``POST /api/auth/password/reset/request/`` — same response whether or not the account exists."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = MobileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mobile = serializer.validated_data["mobile"]
        if User.objects.filter(username=mobile, is_active=True).exists():
            code = OTPCode.issue(mobile, OTPCode.Purpose.RESET_PASSWORD)
            get_sms_sender().send(mobile, f"Password reset code: {code}")
        return Response(status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
    """``POST /api/auth/password/reset/confirm/`` — set a new password with a valid reset code."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not OTPCode.verify(data["mobile"], OTPCode.Purpose.RESET_PASSWORD, data["code"]):
            return Response({"code": ["Invalid or expired code."]}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.get(username=data["mobile"])
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})
