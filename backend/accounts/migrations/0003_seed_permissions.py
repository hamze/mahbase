from django.db import migrations

from accounts.permission_codes import seed_permissions


def seed(apps, schema_editor) -> None:
    seed_permissions(apps.get_model("accounts", "Permission"), apps.get_model("accounts", "Group"))


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_rbac_group_permission"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
