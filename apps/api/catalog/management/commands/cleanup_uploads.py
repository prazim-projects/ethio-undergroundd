from django.core.management.base import BaseCommand
from django.utils import timezone
from catalog.models import UploadSession
from catalog.resumable import staging_root, upload_lock


class Command(BaseCommand):
    help = "Remove expired resumable upload sessions and their private staging files"

    def handle(self, **options):
        count = 0
        for session in UploadSession.objects.filter(expires_at__lte=timezone.now()).iterator():
            upload_id = session.pk
            try:
                with upload_lock(upload_id):
                    (staging_root() / f"{upload_id}.part").unlink(missing_ok=True)
                    session.delete()
                (staging_root() / f"{upload_id}.lock").unlink(missing_ok=True)
                count += 1
            except (BlockingIOError, PermissionError):
                continue
        self.stdout.write(f"Removed {count} expired upload sessions")
