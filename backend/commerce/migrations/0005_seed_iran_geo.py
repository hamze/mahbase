import json
from pathlib import Path

from django.db import migrations

# 31 provinces and their real cities from the official 1404 (Solar Hijri) divisions, via
# github.com/sajaddp/list-of-cities-in-Iran (``cities-filtered``; numbered urban zones and same-name duplicates dropped).
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "iran_geo.json"


def seed(apps, schema_editor) -> None:
    Province = apps.get_model("commerce", "Province")
    City = apps.get_model("commerce", "City")
    for province_name, city_names in json.loads(DATA_FILE.read_text(encoding="utf-8")).items():
        province, _ = Province.objects.get_or_create(name=province_name)
        existing = set(City.objects.filter(province=province).values_list("name", flat=True))
        City.objects.bulk_create(City(province=province, name=name) for name in city_names if name not in existing)


class Migration(migrations.Migration):

    dependencies = [
        ("commerce", "0004_contactmessage_banner_notification_productreview_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
