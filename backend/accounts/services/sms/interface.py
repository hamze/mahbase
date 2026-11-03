from typing import Protocol


class SmsSender(Protocol):
    """Contract for the SMS provider used to deliver one-time codes."""

    def send(self, mobile: str, text: str) -> None: ...
