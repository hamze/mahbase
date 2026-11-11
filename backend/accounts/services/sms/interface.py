from typing import Protocol

from accounts.services.sms.templates import SmsTemplate


class SmsSender(Protocol):
    """Contract for an SMS provider (panel). Messages are always provider templates filled with ordered tokens."""

    def send_template(self, mobile: str, template: SmsTemplate, tokens: list[str]) -> None:
        """Send one templated message; raises when the provider refuses it or is unreachable."""
