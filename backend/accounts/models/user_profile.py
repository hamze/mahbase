import re

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models, transaction

MOBILE_PATTERN = re.compile(r"^09\d{9}$")
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_mobile(value: str) -> str:
    """``+98 912 …``, ``0098912…``, ``912…`` and Persian digits → ``09xxxxxxxxx``; raises on anything else."""
    digits = re.sub(r"[\s\-()]", "", value.translate(_DIGITS))
    for prefix in ("+98", "0098", "98"):
        if digits.startswith(prefix) and len(digits) == len(prefix) + 10:
            digits = "0" + digits[len(prefix):]
            break
    if len(digits) == 10 and digits.startswith("9"):
        digits = "0" + digits
    if not MOBILE_PATTERN.match(digits):
        raise ValidationError("شماره موبایل معتبر وارد کنید (09xxxxxxxxx).")
    return digits


class UserProfile(models.Model):
    """Customer data next to ``auth.User`` (``username`` is the normalized mobile).

    ``user.is_active`` is the single source of truth for login. BLOCKED implies ``is_active=False``;
    deactivation keeps ACTIVE with ``is_active=False``.
    """

    class CustomerTier(models.TextChoices):
        RETAIL = "RETAIL"
        WHOLESALE = "WHOLESALE"

    class AccountStatus(models.TextChoices):
        ACTIVE = "ACTIVE"
        BLOCKED = "BLOCKED"

    class CreatedSource(models.TextChoices):
        SELF_SIGNUP = "SELF_SIGNUP"
        ADMIN_CREATED = "ADMIN_CREATED"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    customer_tier = models.CharField(max_length=10, choices=CustomerTier.choices, default=CustomerTier.RETAIL)
    account_status = models.CharField(max_length=10, choices=AccountStatus.choices, default=AccountStatus.ACTIVE)
    created_source = models.CharField(max_length=15, choices=CreatedSource.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        permissions = [
            ("admin_users_view", "Can view users"),
            ("admin_users_create", "Can create users"),
            ("admin_users_edit", "Can edit users"),
            ("admin_users_tier", "Can change customer tier"),
            ("admin_users_block", "Can block, deactivate and reactivate users"),
        ]

    def __str__(self) -> str:
        return self.user.get_username()

    @staticmethod
    def tier_of(user: User) -> str:
        """Pricing tier; users without a profile (e.g. staff created with createsuperuser) price as retail."""
        profile = getattr(user, "profile", None)
        return profile.customer_tier if profile else UserProfile.CustomerTier.RETAIL

    @classmethod
    def create_customer(
        cls,
        mobile: str,
        source: str,
        *,
        first_name: str = "",
        last_name: str = "",
        customer_tier: str = CustomerTier.RETAIL,
    ) -> User:
        with transaction.atomic():
            user = User(username=mobile, first_name=first_name, last_name=last_name)
            user.set_unusable_password()
            user.save()
            cls.objects.create(user=user, customer_tier=customer_tier, created_source=source)
        return user

    @staticmethod
    def validate_new_mobile(user: User, mobile: str) -> None:
        if mobile == user.get_username():
            raise ValidationError({"new_mobile": "این شماره هم‌اکنون شماره موبایل شماست."})
        if User.objects.filter(username=mobile).exists():
            raise ValidationError({"new_mobile": "این شماره موبایل متعلق به حساب دیگری است."})

    @classmethod
    def change_mobile(cls, user: User, mobile: str) -> None:
        """Make ``mobile`` the login (``username``); both numbers were already verified by the caller."""
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user.pk)
            cls.validate_new_mobile(user, mobile)
            user.username = mobile
            user.save(update_fields=["username"])

    def block(self) -> None:
        self._set_state(self.AccountStatus.BLOCKED, is_active=False)

    def deactivate(self) -> None:
        self._set_state(self.AccountStatus.ACTIVE, is_active=False)

    def reactivate(self) -> None:
        self._set_state(self.AccountStatus.ACTIVE, is_active=True)

    def _set_state(self, account_status: str, *, is_active: bool) -> None:
        with transaction.atomic():
            self.account_status = account_status
            self.save(update_fields=["account_status", "updated_at"])
            self.user.is_active = is_active
            self.user.save(update_fields=["is_active"])
