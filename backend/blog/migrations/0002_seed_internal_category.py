from django.db import migrations

INTERNAL_PAGES_SLUG = "internal-pages"


def seed(apps, schema_editor) -> None:
    apps.get_model("blog", "BlogCategory").objects.get_or_create(
        slug=INTERNAL_PAGES_SLUG, defaults={"name": "صفحات داخلی", "is_internal": True, "is_active": True}
    )


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
