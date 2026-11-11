import requests
from django.conf import settings

from accounts.services.sms.templates import KAVENEGAR_TEMPLATES, SmsTemplate

# Kavenegar Verify/Lookup takes the template's tokens as token, token2, token3.
TOKEN_PARAMS = ("token", "token2", "token3")


class KavenegarError(Exception):
    """Kavenegar answered with a non-200 return status."""


class KavenegarSmsSender:
    """Kavenegar pattern sending (``verify/lookup``) with ``KAVENEGAR_API_KEY``."""

    def send_template(self, mobile: str, template: SmsTemplate, tokens: list[str]) -> None:
        params = {"receptor": mobile, "template": KAVENEGAR_TEMPLATES[template]}
        params.update(zip(TOKEN_PARAMS, tokens))
        response = requests.get(
            f"{settings.KAVENEGAR_API_URL}/{settings.KAVENEGAR_API_KEY}/verify/lookup.json",
            params=params,
            timeout=settings.SMS_TIMEOUT_SECONDS,
        )
        # Kavenegar answers JSON with its own status in ``return.status`` (200 = accepted), also on errors.
        status = response.json()["return"]["status"]
        if status != 200:
            raise KavenegarError(f"Kavenegar refused template {template} with status {status}")
