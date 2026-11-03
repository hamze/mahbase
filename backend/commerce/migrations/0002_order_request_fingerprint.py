from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("commerce", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="request_fingerprint",
            field=models.CharField(default="", max_length=64),
            preserve_default=False,
        ),
    ]
