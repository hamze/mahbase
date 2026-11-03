from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import OTPCode, UserProfile
from accounts.serializers import MobileSerializer, OTPVerifySerializer
from accounts.services.sms.provider import get_sms_sender


class OTPRequestView(APIView):
    """``POST /api/auth/otp/request/`` — send a login code to a mobile (customers sign up on first verify)."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = MobileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mobile = serializer.validated_data["mobile"]
        code = OTPCode.issue(mobile, OTPCode.Purpose.LOGIN)
        get_sms_sender().send(mobile, f"Login code: {code}")
        return Response({"expires_in": settings.OTP_TTL_SECONDS}, status=status.HTTP_202_ACCEPTED)


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
            return Response({"code": ["Invalid or expired code."]}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(username=mobile).first()
        if user is None:
            user = UserProfile.create_customer(mobile, UserProfile.CreatedSource.SELF_SIGNUP)
        if not user.is_active:
            return Response({"detail": "This account is inactive."}, status=status.HTTP_403_FORBIDDEN)
        refresh = RefreshToken.for_user(user)
        user_logged_in.send(sender=User, request=request._request, user=user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})
