from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0006_remove_legacy_artist_album_track"),
    ]

    operations = [
        migrations.AlterField(
            model_name="creatorprofile",
            name="profile_type",
            field=models.CharField(
                choices=[("listener", "Regular user"), ("creator", "Creator")],
                default="listener",
                max_length=16,
            ),
        ),
    ]
