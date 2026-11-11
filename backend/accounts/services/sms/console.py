import sys

from accounts.services.sms.templates import SmsTemplate


class ConsoleSmsSender:
    """Development sender, like Django's console email backend: writes the message to stdout instead of sending it."""

    def send_template(self, mobile: str, template: SmsTemplate, tokens: list[str]) -> None:
        sys.stdout.write(f"SMS to {mobile}: {template} {tokens}\n")
        sys.stdout.flush()
