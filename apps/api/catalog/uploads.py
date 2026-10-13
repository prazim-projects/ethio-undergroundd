import mimetypes
import json
from pathlib import Path
from decimal import Decimal, InvalidOperation

from django.core.files.uploadedfile import UploadedFile
from django.db.models import F
from django.utils.text import get_valid_filename
from django.http import FileResponse
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from rest_framework.authtoken.models import Token

from .models import CreativeWork, CreatorProfile, Track

MAX_UPLOAD_SIZE = 30 * 1024 * 1024
MAX_AVATAR_SIZE = 4 * 1024 * 1024
BLOCKED_EXTENSIONS = {".bat", ".cmd", ".com", ".dll", ".exe", ".hta", ".html", ".js", ".jar", ".php", ".ps1", ".sh", ".svg", ".vbs"}
WORK_UPLOAD_RULES = {
    "music": {"ext": {".mp3", ".m4a", ".aac", ".ogg", ".wav"}, "mime": {"audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav"}},
    "photography": {"ext": {".jpg", ".jpeg", ".png", ".webp"}, "mime": {"image/jpeg", "image/png", "image/webp"}},
    "visual_art": {"ext": {".jpg", ".jpeg", ".png", ".webp", ".pdf"}, "mime": {"image/jpeg", "image/png", "image/webp", "application/pdf"}},
    "videography": {"ext": {".mp4", ".mov", ".webm"}, "mime": {"video/mp4", "video/quicktime", "video/webm"}},
    "poetry": {"ext": {".txt", ".pdf"}, "mime": {"text/plain", "application/pdf"}},
    "other": {"ext": {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt", ".mp3", ".mp4"}, "mime": {"image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "audio/mpeg", "video/mp4"}},
}
AVATAR_RULE = {"ext": {".jpg", ".jpeg", ".png", ".webp"}, "mime": {"image/jpeg", "image/png", "image/webp"}}


def user_from_token(request):
    raw_token = request.headers.get("Authorization", "")
    if not raw_token.startswith("Token "):
        raise PermissionError("Token authentication required")
    try:
        return Token.objects.select_related("user").get(key=raw_token[6:]).user
    except Token.DoesNotExist as exc:
        raise PermissionError("Invalid token") from exc


def _safe_file_name(uploaded_file: UploadedFile) -> str:
    return get_valid_filename(Path(uploaded_file.name).name).lower()


def _upload_error(uploaded_file: UploadedFile, rule: dict[str, set[str]], max_size: int) -> str:
    filename = _safe_file_name(uploaded_file)
    ext = Path(filename).suffix.lower()
    content_type = (uploaded_file.content_type or mimetypes.guess_type(filename)[0] or "").lower()
    if not filename or ext in BLOCKED_EXTENSIONS:
        return "This file type is not allowed"
    if uploaded_file.size > max_size:
        return "File is too large"
    if ext not in rule["ext"] or content_type not in rule["mime"]:
        return "The selected file does not match the allowed type for this upload"
    uploaded_file.name = filename
    return ""


def avatar_upload_error(uploaded_file: UploadedFile) -> str:
    return _upload_error(uploaded_file, AVATAR_RULE, MAX_AVATAR_SIZE)


def _work_payload(work):
    return {
        "id": work.id,
        "title": work.title,
        "workType": work.work_type,
        "description": work.description,
        "file": work.file.url if work.file else "",
        "thumbnail": work.thumbnail.url if work.thumbnail else "",
        "published": work.published,
        "isPayable": work.is_payable,
        "priceEtb": str(work.price_etb),
        "playCount": work.play_count,
        "downloadCount": work.download_count,
        "createdAt": work.created_at.isoformat() if work.created_at else "",
        "updatedAt": work.updated_at.isoformat() if work.updated_at else "",
    }


def _creator_profile_for_user(user):
    profile, _ = CreatorProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": user.get_full_name() or user.username},
    )
    return profile


def _parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"true", "1", "yes", "on"}


@csrf_exempt
def upload_work(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    uploaded_file = request.FILES.get("file")
    title = request.POST.get("title", "").strip()
    work_type = request.POST.get("workType", "other")
    if not uploaded_file or not title:
        return JsonResponse({"error": "title and file are required"}, status=400)
    valid_types = {choice for choice, _ in CreativeWork.WorkType.choices}
    if work_type not in valid_types:
        return JsonResponse({"error": "Unsupported work type"}, status=400)
    upload_error = _upload_error(uploaded_file, WORK_UPLOAD_RULES[work_type], MAX_UPLOAD_SIZE)
    if upload_error:
        return JsonResponse({"error": upload_error}, status=400)
    profile = _creator_profile_for_user(user)
    if profile.profile_type != CreatorProfile.ProfileType.CREATOR:
        return JsonResponse({"error": "Only artist / creator accounts can publish work"}, status=403)
    is_payable = request.POST.get("isPayable", "false").lower() == "true"
    try:
        price_etb = Decimal(request.POST.get("priceEtb", "0") or "0")
    except InvalidOperation:
        return JsonResponse({"error": "Price must be a valid number"}, status=400)
    if is_payable and price_etb <= 0:
        return JsonResponse({"error": "Payable works need a price greater than 0 ETB"}, status=400)
    work = CreativeWork.objects.create(
        creator=profile,
        title=title,
        work_type=work_type,
        description=request.POST.get("description", ""),
        file=uploaded_file,
        is_payable=is_payable,
        price_etb=price_etb if is_payable else 0,
    )
    return JsonResponse(
        {
            "id": work.id,
            "title": work.title,
            "workType": work.work_type,
            "file": work.file.url,
            "isPayable": work.is_payable,
            "priceEtb": str(work.price_etb),
        },
        status=201,
    )


@csrf_exempt
def my_works(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    profile = _creator_profile_for_user(user)
    if profile.profile_type != CreatorProfile.ProfileType.CREATOR:
        return JsonResponse({"error": "Only artist / creator accounts can manage creations"}, status=403)
    works = CreativeWork.objects.filter(creator=profile).order_by("-created_at")
    return JsonResponse({"works": [_work_payload(work) for work in works]})


@csrf_exempt
def update_work_settings(request, work_id):
    if request.method not in {"POST", "PATCH"}:
        return JsonResponse({"error": "POST or PATCH required"}, status=405)
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    profile = _creator_profile_for_user(user)
    work = CreativeWork.objects.filter(pk=work_id, creator=profile).first()
    if work is None:
        return JsonResponse({"error": "Work was not found"}, status=404)
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    title = str(payload.get("title", work.title)).strip()
    if not title:
        return JsonResponse({"error": "Title is required"}, status=400)
    work.title = title
    work.description = str(payload.get("description", work.description)).strip()
    work.published = _parse_bool(payload.get("published"), work.published)
    work.is_payable = _parse_bool(payload.get("isPayable"), work.is_payable)
    try:
        price_etb = Decimal(str(payload.get("priceEtb", work.price_etb) or "0"))
    except InvalidOperation:
        return JsonResponse({"error": "Price must be a valid number"}, status=400)
    if work.is_payable and price_etb <= 0:
        return JsonResponse({"error": "Payable works need a price greater than 0 ETB"}, status=400)
    work.price_etb = price_etb if work.is_payable else 0
    work.save(update_fields=["title", "description", "published", "is_payable", "price_etb", "updated_at"])
    return JsonResponse({"work": _work_payload(work)})


def _track_file_response(track_id, as_attachment):
    track = Track.objects.filter(pk=track_id).first()
    if track is None or not track.audio_file:
        return JsonResponse({"error": "Track audio was not found"}, status=404)
    try:
        handle = track.audio_file.open("rb")
    except FileNotFoundError:
        return JsonResponse({"error": "Track file was not found"}, status=404)
    filename = track.audio_file.name.rsplit("/", 1)[-1]
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(handle, as_attachment=as_attachment, filename=filename, content_type=content_type)


def stream_track(request, track_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)
    return _track_file_response(track_id, as_attachment=False)


def record_track_play(request, track_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    updated = Track.objects.filter(pk=track_id).update(play_count=F("play_count") + 1)
    if not updated:
        return JsonResponse({"error": "Track was not found"}, status=404)
    track = Track.objects.get(pk=track_id)
    return JsonResponse({"playCount": track.play_count, "downloadCount": track.download_count})


def download_track(request, track_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)
    Track.objects.filter(pk=track_id).update(download_count=F("download_count") + 1)
    return _track_file_response(track_id, as_attachment=True)


def _work_file_response(work_id, as_attachment):
    work = CreativeWork.objects.filter(pk=work_id, published=True).first()
    if work is None or not work.file:
        return JsonResponse({"error": "Work file was not found"}, status=404)
    try:
        handle = work.file.open("rb")
    except FileNotFoundError:
        return JsonResponse({"error": "Work file was not found"}, status=404)
    filename = work.file.name.rsplit("/", 1)[-1]
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(handle, as_attachment=as_attachment, filename=filename, content_type=content_type)


def stream_work(request, work_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)
    return _work_file_response(work_id, as_attachment=False)


def record_work_play(request, work_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    updated = CreativeWork.objects.filter(pk=work_id, published=True).update(play_count=F("play_count") + 1)
    if not updated:
        return JsonResponse({"error": "Work was not found"}, status=404)
    work = CreativeWork.objects.get(pk=work_id)
    return JsonResponse({"playCount": work.play_count, "downloadCount": work.download_count})


def download_work(request, work_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)
    CreativeWork.objects.filter(pk=work_id, published=True).update(download_count=F("download_count") + 1)
    return _work_file_response(work_id, as_attachment=True)
