from django.core.management.base import BaseCommand

from accounts.models import Group, Permission
from accounts.permission_codes import seed_permissions


class Command(BaseCommand):
    help = "Create or update the baseline RBAC permission codes and the system admin group."

    def handle(self, *args: object, **options: object) -> None:
        seed_permissions(Permission, Group)
        self.stdout.write(f"{Permission.objects.count()} permissions seeded.")
