import sys


class ConsoleSmsSender:
    """Development sender, like Django's console email backend: writes the message to stdout instead of sending it."""

    def send(self, mobile: str, text: str) -> None:
        sys.stdout.write(f"SMS to {mobile}: {text}\n")
        sys.stdout.flush()
