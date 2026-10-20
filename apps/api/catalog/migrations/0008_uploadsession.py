import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("catalog", "0007_creator_profile_label")]
    operations = [migrations.CreateModel(
        name="UploadSession",
        fields=[
            ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ("filename", models.CharField(max_length=255)),
            ("content_type", models.CharField(max_length=100)),
            ("work_type", models.CharField(max_length=32)),
            ("size", models.PositiveBigIntegerField()),
            ("offset", models.PositiveBigIntegerField(default=0)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("expires_at", models.DateTimeField(db_index=True)),
            ("creator", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="catalog.creatorprofile")),
            ("work", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="catalog.creativework")),
        ],
    )]
