import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac


class OTPCode(models.Model):
    """One-time code for a mobile. Only the newest code per (mobile, purpose) can be verified."""

    class Purpose(models.TextChoices):
        LOGIN = "LOGIN"
        RESET_PASSWORD = "RESET_PASSWORD"
        # A mobile change needs a code sent to the current number and one sent to the new number.
        MOBILE_CHANGE_OLD = "MOBILE_CHANGE_OLD"
        MOBILE_CHANGE_NEW = "MOBILE_CHANGE_NEW"

    mobile = models.CharField(max_length=11)
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["mobile", "purpose", "-created_at"], name="otp_mobile_purpose_idx")]

    @staticmethod
    def hash_code(mobile: str, purpose: str, code: str) -> str:
        return salted_hmac("accounts.otp", f"{mobile}:{purpose}:{code}").hexdigest()

    @classmethod
    def issue(cls, mobile: str, purpose: str) -> str:
        """Create a new code and return it in plain text (for sending only; just the hash is stored)."""
        now = timezone.now()
        recent = now - timedelta(seconds=settings.OTP_RESEND_SECONDS)
        if cls.objects.filter(mobile=mobile, purpose=purpose, created_at__gt=recent).exists():
            raise ValidationError({"mobile": "کد به‌تازگی ارسال شده است؛ لطفا کمی بعد دوباره تلاش کنید."})
        code = f"{secrets.randbelow(10 ** settings.OTP_LENGTH):0{settings.OTP_LENGTH}d}"
        cls.objects.create(
            mobile=mobile,
            purpose=purpose,
            code_hash=cls.hash_code(mobile, purpose, code),
            expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
        )
        return code

    @classmethod
    def verify(cls, mobile: str, purpose: str, code: str) -> bool:
        return cls.verify_all([(mobile, purpose, code)])[0]

    @classmethod
    def verify_all(cls, checks: list[tuple[str, str, str]]) -> list[bool]:
        """Atomic check of ``(mobile, purpose, code)`` codes that only work together: lock each newest code, reject
        consumed/expired/exhausted ones, count an attempt on each, and consume them only when every code matches.

        Returns the per-code result. The attempts are committed even when a code does not match.
        """
        with transaction.atomic():
            found = []
            for mobile, purpose, code in checks:
                otp = cls.objects.select_for_update().filter(mobile=mobile, purpose=purpose).first()
                if (
                    otp is None
                    or otp.consumed_at is not None
                    or otp.expires_at <= timezone.now()
                    or otp.attempts >= settings.OTP_MAX_ATTEMPTS
                ):
                    found.append((None, False))
                    continue
                otp.attempts += 1
                found.append((otp, constant_time_compare(otp.code_hash, cls.hash_code(mobile, purpose, code))))
            all_matched = all(matched for _, matched in found)
            for otp, _ in found:
                if otp is None:
                    continue
                if all_matched:
                    otp.consumed_at = timezone.now()
                otp.save(update_fields=["attempts", "consumed_at"])
        return [matched for _, matched in found]
