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
            raise ValidationError({"mobile": "A code was sent recently. Please wait before requesting another."})
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
        """Atomic check: lock the newest code, reject consumed/expired/exhausted, count the attempt, consume on match.

        The attempt is committed even when the code does not match.
        """
        with transaction.atomic():
            otp = cls.objects.select_for_update().filter(mobile=mobile, purpose=purpose).first()
            if (
                otp is None
                or otp.consumed_at is not None
                or otp.expires_at <= timezone.now()
                or otp.attempts >= settings.OTP_MAX_ATTEMPTS
            ):
                return False
            otp.attempts += 1
            matched = constant_time_compare(otp.code_hash, cls.hash_code(mobile, purpose, code))
            if matched:
                otp.consumed_at = timezone.now()
            otp.save(update_fields=["attempts", "consumed_at"])
        return matched
