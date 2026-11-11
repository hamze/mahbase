from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import UserProfile
from accounts.tokens import PermissionRefreshToken
from catalog.tests.helpers import make_staff


class MobileChangeTests(TestCase):
    def setUp(self) -> None:
        self.user = UserProfile.create_customer("09120000001", UserProfile.CreatedSource.SELF_SIGNUP)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.sent: dict[str, str] = {}
        patcher = mock.patch(
            "accounts.services.sms.console.ConsoleSmsSender.send_template",
            lambda _, mobile, template, tokens: self.sent.__setitem__(mobile, tokens[0]),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_change_needs_the_codes_of_both_numbers(self) -> None:
        self.assertEqual(self.client.post("/api/auth/mobile/change/request/", {"new_mobile": "09129999999"}).status_code, 202)
        wrong = self.client.post("/api/auth/mobile/change/confirm/", {
            "new_mobile": "09129999999", "old_code": "000000", "new_code": self.sent["09129999999"],
        })
        self.assertEqual(wrong.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "09120000001")

        # The wrong old code did not use up the right new code: correcting the typo is enough.
        confirmed = self.client.post("/api/auth/mobile/change/confirm/", {
            "new_mobile": "09129999999", "old_code": self.sent["09120000001"], "new_code": self.sent["09129999999"],
        })
        self.assertEqual((confirmed.status_code, confirmed.json()["data"]["username"]), (200, "09129999999"))

    def test_login_code_is_limited_to_one_per_two_minutes(self) -> None:
        self.assertEqual(APIClient().post("/api/auth/otp/request/", {"mobile": "09121111111"}).status_code, 202)
        again = APIClient().post("/api/auth/otp/request/", {"mobile": "09121111111"})
        self.assertEqual(again.status_code, 400)

    def test_customer_sessions_last_90_days_and_staff_sessions_one_day(self) -> None:
        customer = PermissionRefreshToken.for_user(self.user)
        staff = PermissionRefreshToken.for_user(make_staff("staff"))
        self.assertEqual(customer["exp"] - customer["iat"], 90 * 86400)
        self.assertEqual(staff["exp"] - staff["iat"], 86400)
