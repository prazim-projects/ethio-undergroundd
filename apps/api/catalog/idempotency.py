"""Replay successful authenticated mutations after a lost response, for 24 hours."""
import hashlib
import json
import re
from datetime import timedelta
from functools import wraps

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .models import MutationReceipt


def idempotent_mutation(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key or request.method not in {"POST", "PATCH"}:
            return view(request, *args, **kwargs)
        if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", key):
            return JsonResponse({"error": "Invalid Idempotency-Key"}, status=400)
        auth = request.headers.get("Authorization", "")
        token = Token.objects.filter(key=auth[6:], user__is_active=True).first() if auth.startswith("Token ") else None
        if token is None:
            return JsonResponse({"error": "Token authentication required"}, status=401)
        digest = hashlib.sha256()
        if request.content_type == "multipart/form-data":
            digest.update(json.dumps(sorted(request.POST.lists()), sort_keys=True).encode())
            for name, files in sorted(request.FILES.lists()):
                for file in files:
                    digest.update(f"{name}:{file.name}:{file.size}:{file.content_type}".encode())
                    for chunk in file.chunks():
                        digest.update(chunk)
                    file.seek(0)
        else:
            digest.update(request.body)
        fingerprint = digest.hexdigest()
        operation = f"{request.method}:{request.path}"
        MutationReceipt.objects.filter(user=token.user, created_at__lt=timezone.now() - timedelta(days=1)).delete()
        with transaction.atomic():
            receipt, _ = MutationReceipt.objects.get_or_create(user=token.user, key=key,
                defaults={"operation": operation, "fingerprint": fingerprint})
            receipt = MutationReceipt.objects.select_for_update().get(pk=receipt.pk)
            if receipt.operation != operation or receipt.fingerprint != fingerprint:
                return JsonResponse({"error": "This idempotency key was already used for a different request"}, status=409)
            if receipt.payload is not None:
                response = JsonResponse(receipt.payload, status=receipt.status)
                response["Idempotency-Replayed"] = "true"
                return response
            response = view(request, *args, **kwargs)
            if 200 <= response.status_code < 300:
                receipt.payload = json.loads(response.content)
                receipt.status = response.status_code
                receipt.save(update_fields=["payload", "status"])
            else:
                receipt.delete()
            return response
    return wrapped
