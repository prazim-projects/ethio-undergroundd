"""Authenticated, offset-based uploads. Staging files never live under MEDIA_ROOT."""
import json
import os
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import CreatorProfile, UploadSession
from .uploads import WORK_UPLOAD_RULES, _upload_error, create_uploaded_work, user_from_token

CHUNK_SIZE = 2 * 1024 * 1024
MAX_RESUMABLE_SIZE = 1024 * 1024 * 1024


def staging_root():
    root = Path(settings.PRIVATE_UPLOAD_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    return root


@contextmanager
def upload_lock(upload_id):
    # OS locks cover SQLite and multiple web workers, and release after a crash.
    with (staging_root() / f"{upload_id}.lock").open("a+b") as handle:
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            if not handle.read(1):
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def session_payload(session):
    return {"id": str(session.pk), "offset": session.offset, "size": session.size,
            "chunkSize": CHUNK_SIZE, "workId": session.work_id,
            "expiresAt": session.expires_at.isoformat()}


@csrf_exempt
def start_upload(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    profile = CreatorProfile.objects.filter(user=user, profile_type="creator").first()
    if profile is None:
        return JsonResponse({"error": "Only creator accounts can upload"}, status=403)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict) or type(data.get("size")) is not int:
            raise ValueError
        size = data["size"]
        work_type = data.get("workType")
        if size <= 0 or work_type not in WORK_UPLOAD_RULES:
            raise ValueError
        candidate = SimpleNamespace(name=str(data.get("filename", "")), size=size,
                                    content_type=str(data.get("contentType", "")))
        error = _upload_error(candidate, WORK_UPLOAD_RULES[work_type], MAX_RESUMABLE_SIZE)
        if error or Path(candidate.name).suffix not in {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".mp4", ".mov", ".webm"}:
            return JsonResponse({"error": error or "Resumable uploads support audio and video"}, status=400)
        if len(candidate.name) > 255 or len(candidate.content_type) > 100:
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"error": "Valid filename, size, contentType and workType required"}, status=400)
    with transaction.atomic():
        CreatorProfile.objects.select_for_update().get(pk=profile.pk)
        if UploadSession.objects.filter(creator=profile, work__isnull=True, expires_at__gt=timezone.now()).count() >= 3:
            return JsonResponse({"error": "Finish or cancel an existing upload first (maximum 3)"}, status=429)
        session = UploadSession.objects.create(creator=profile, filename=candidate.name,
            content_type=candidate.content_type, work_type=work_type, size=size,
            expires_at=timezone.now() + timedelta(days=7))
    return JsonResponse(session_payload(session), status=201)


@csrf_exempt
def upload_session(request, upload_id):
    if request.method not in {"GET", "PATCH", "POST", "DELETE"}:
        return JsonResponse({"error": "GET, PATCH, POST or DELETE required"}, status=405)
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    session = UploadSession.objects.filter(pk=upload_id, creator__user=user).first()
    if session is None:
        return JsonResponse({"error": "Upload not found"}, status=404)
    if session.expires_at <= timezone.now():
        return JsonResponse({"error": "Upload expired; select the file to start again"}, status=410)
    if request.method == "GET":
        response = JsonResponse(session_payload(session))
        response["Cache-Control"] = "private, no-store"
        return response
    if session.creator.profile_type != "creator":
        return JsonResponse({"error": "Creator account required"}, status=403)
    try:
        with upload_lock(upload_id), transaction.atomic():
            session = UploadSession.objects.select_for_update().get(pk=upload_id)
            path = staging_root() / f"{upload_id}.part"
            if request.method == "DELETE":
                path.unlink(missing_ok=True)
                session.delete()
                return JsonResponse({"cancelled": True})
            if session.work_id:
                return JsonResponse(session_payload(session))
            if request.method == "PATCH":
                try:
                    offset = int(request.headers.get("Upload-Offset", "-1"))
                    length = int(request.META.get("CONTENT_LENGTH", "0"))
                except ValueError:
                    return JsonResponse({"error": "Invalid offset or length"}, status=400)
                if offset != session.offset:
                    return JsonResponse({"error": "Offset mismatch", **session_payload(session)}, status=409)
                if length <= 0 or length > CHUNK_SIZE or offset + length > session.size:
                    return JsonResponse({"error": "Invalid chunk size"}, status=400)
                body = request.body
                if len(body) != length:
                    return JsonResponse({"error": "Incomplete chunk"}, status=400)
                with path.open("r+b" if path.exists() else "w+b") as target:
                    target.seek(0, os.SEEK_END)
                    if target.tell() < offset:
                        return JsonResponse({"error": "Staging data missing; cancel and restart upload"}, status=410)
                    # Discard uncommitted bytes left by an interrupted process.
                    target.seek(offset)
                    target.write(body)
                    target.truncate()
                    target.flush()
                    os.fsync(target.fileno())
                session.offset += length
                session.save(update_fields=["offset"])
                return JsonResponse(session_payload(session))
            if session.offset != session.size or not path.exists() or path.stat().st_size != session.size:
                return JsonResponse({"error": "Upload is incomplete", **session_payload(session)}, status=409)
            data = request.POST.copy()
            data["workType"] = session.work_type
            with path.open("rb") as handle:
                uploaded = UploadedFile(handle, name=session.filename, content_type=session.content_type, size=session.size)
                response = create_uploaded_work(user, data, uploaded, request.FILES.get("thumbnail"), MAX_RESUMABLE_SIZE)
            if response.status_code == 201:
                session.work_id = json.loads(response.content)["id"]
                session.save(update_fields=["work"])
        if session.work_id:
            path.unlink(missing_ok=True)
        return response
    except (BlockingIOError, PermissionError):
        return JsonResponse({"error": "Upload is busy; retry shortly"}, status=409)
