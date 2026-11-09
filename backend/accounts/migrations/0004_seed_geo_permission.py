from django.db import migrations

from accounts.permission_codes import ADMIN_GROUP_SLUG, seed_permissions


def seed(apps, schema_editor) -> None:
    """Upsert the new ``geo.manage`` code; the existing admin group only gets codes at creation, so grant it here."""
    Permission = apps.get_model("accounts", "Permission")
    Group = apps.get_model("accounts", "Group")
    seed_permissions(Permission, Group)
    Group.objects.get(slug=ADMIN_GROUP_SLUG).permissions.add(Permission.objects.get(code="geo.manage"))


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_seed_permissions"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
