from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import OTPCode, UserProfile
from accounts.permissions import IsCustomer
from accounts.serializers import MeSerializer, MobileChangeConfirmSerializer, MobileChangeRequestSerializer
from accounts.services.otp_delivery import SmsDeliveryFailed, send_code
from accounts.throttles import OTPIPThrottle
from config.api import Responses


class MobileChangeRequestView(APIView):
    """``POST /api/auth/mobile/change/request/`` — text a code to the current number and one to ``new_mobile``.

    Both are needed to confirm, so nobody can move an account to a number they do not hold, nor take over an
    account from a phone that is not theirs.
    """

    permission_classes = [IsCustomer]
    throttle_classes = [OTPIPThrottle]

    def post(self, request: Request) -> Response:
        serializer = MobileChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_mobile = serializer.validated_data["new_mobile"]
        UserProfile.validate_new_mobile(request.user, new_mobile)
        try:
            send_code(request.user.get_username(), OTPCode.Purpose.MOBILE_CHANGE_OLD)
            send_code(new_mobile, OTPCode.Purpose.MOBILE_CHANGE_NEW)
        except SmsDeliveryFailed:
            return Responses.get_response(Responses.ACCOUNT_GENERAL.SMS_SEND_FAILED)
        return Response(status=status.HTTP_202_ACCEPTED)


class MobileChangeConfirmView(APIView):
    """``POST /api/auth/mobile/change/confirm/`` — both codes valid → ``new_mobile`` becomes the login."""

    permission_classes = [IsCustomer]

    def post(self, request: Request) -> Response:
        serializer = MobileChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Neither code is used up unless both match, so one typo does not force a new request for both.
        old_ok, new_ok = OTPCode.verify_all([
            (request.user.get_username(), OTPCode.Purpose.MOBILE_CHANGE_OLD, data["old_code"]),
            (data["new_mobile"], OTPCode.Purpose.MOBILE_CHANGE_NEW, data["new_code"]),
        ])
        errors = {}
        if not old_ok:
            errors["old_code"] = [Responses.ACCOUNT_GENERAL.INVALID_OTP["message"]]
        if not new_ok:
            errors["new_code"] = [Responses.ACCOUNT_GENERAL.INVALID_OTP["message"]]
        if errors:
            return Responses.get_response(Responses.ACCOUNT_GENERAL.INVALID_OTP, errors)
        UserProfile.change_mobile(request.user, data["new_mobile"])
        request.user.refresh_from_db()
        return Response(MeSerializer(request.user).data)
