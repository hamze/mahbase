from django.core.management.base import BaseCommand

from catalog.media_cleanup import cleanup_temporary_media


class Command(BaseCommand):
    help = "Delete expired, unclaimed temporary media uploads and their files."

    def handle(self, *args, **options) -> None:
        deleted = cleanup_temporary_media()
        self.stdout.write(f"Deleted {deleted} temporary media assets.")
