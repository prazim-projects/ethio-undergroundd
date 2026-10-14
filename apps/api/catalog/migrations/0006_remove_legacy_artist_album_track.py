from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_public_profile_ids"),
    ]

    operations = [
        migrations.DeleteModel(name="Track"),
        migrations.DeleteModel(name="Album"),
        migrations.DeleteModel(name="Artist"),
    ]
