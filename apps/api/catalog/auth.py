import json
import os
import re
import secrets
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.contrib.auth import authenticate, get_user_model, login
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import CreatorProfile
from .uploads import avatar_upload_error, user_from_token

USERNAME_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{2,29}$")
VALID_PROFILE_TYPES = {choice for choice, _ in CreatorProfile.ProfileType.choices}


def _profile_payload(profile):
    return {
        "displayName": profile.display_name,
        "profileType": profile.profile_type,
        "bio": profile.bio,
        "location": profile.location,
        "disciplines": profile.disciplines,
        "avatar": profile.avatar.url if profile.avatar else "",
    }


def _token_response(user):
    from rest_framework.authtoken.models import Token

    profile, _ = CreatorProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": user.get_full_name() or user.username},
    )
    return JsonResponse(
        {
            "token": Token.objects.get_or_create(user=user)[0].key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                **_profile_payload(profile),
            },
        }
    )


@csrf_exempt
def sign_up(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    username = payload.get("username", "").strip().lower()
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    confirm_password = payload.get("confirmPassword", "")
    display_name = payload.get("displayName", "").strip()
    profile_type = payload.get("profileType", CreatorProfile.ProfileType.LISTENER)
    if not username or not email or not password or not display_name:
        return JsonResponse({"error": "displayName, username, email, and password are required"}, status=400)
    if not USERNAME_RE.match(username):
        return JsonResponse({"error": "Username must be 3-30 characters and use letters, numbers, dots, dashes, or underscores"}, status=400)
    if len(password) < 8:
        return JsonResponse({"error": "Password must be at least 8 characters"}, status=400)
    if password != confirm_password:
        return JsonResponse({"error": "Passwords do not match"}, status=400)
    if profile_type not in VALID_PROFILE_TYPES:
        return JsonResponse({"error": "Choose regular user or creator"}, status=400)

    User = get_user_model()
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"error": "That username is already taken"}, status=409)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"error": "An account with this email already exists"}, status=409)
    user = User.objects.create_user(username=username, email=email, password=password)
    CreatorProfile.objects.create(user=user, display_name=display_name, profile_type=profile_type)
    login(request, user)
    return _token_response(user)


@csrf_exempt
def sign_in(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    identifier = payload.get("identifier", payload.get("email", "")).strip().lower()
    username = identifier
    User = get_user_model()
    if "@" in identifier:
        user_match = User.objects.filter(email__iexact=identifier).first()
        username = user_match.username if user_match else identifier
    user = authenticate(request, username=username, password=payload.get("password", ""))
    if user is None:
        return JsonResponse({"error": "Invalid username, email, or password"}, status=401)
    login(request, user)
    return _token_response(user)


@csrf_exempt
def fayda_sign_in_start(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    client_id = os.getenv("FAYDA_CLIENT_ID", "").strip()
    redirect_uri = os.getenv("FAYDA_REDIRECT_URI", "").strip()
    authorize_url = os.getenv("FAYDA_AUTHORIZE_URL", "").strip()
    scope = os.getenv("FAYDA_SCOPE", "openid profile email").strip()
    if not client_id or not redirect_uri or not authorize_url:
        return JsonResponse(
            {
                "error": "Fayda sign-in is not configured",
                "requiredEnv": ["FAYDA_CLIENT_ID", "FAYDA_REDIRECT_URI", "FAYDA_AUTHORIZE_URL"],
            },
            status=501,
        )
    state = secrets.token_urlsafe(24)
    request.session["fayda_oauth_state"] = state
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
    )
    return JsonResponse({"authorizationUrl": f"{authorize_url}?{query}"})


@csrf_exempt
def fayda_sign_in_callback(request):
    client_id = os.getenv("FAYDA_CLIENT_ID", "").strip()
    client_secret = os.getenv("FAYDA_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv("FAYDA_REDIRECT_URI", "").strip()
    token_url = os.getenv("FAYDA_TOKEN_URL", "").strip()
    userinfo_url = os.getenv("FAYDA_USERINFO_URL", "").strip()
    if not all([client_id, client_secret, redirect_uri, token_url, userinfo_url]):
        return JsonResponse(
            {
                "error": "Fayda callback token exchange is not configured",
                "requiredEnv": ["FAYDA_CLIENT_ID", "FAYDA_CLIENT_SECRET", "FAYDA_REDIRECT_URI", "FAYDA_TOKEN_URL", "FAYDA_USERINFO_URL"],
            },
            status=501,
        )

    code = request.GET.get("code", "")
    state = request.GET.get("state", "")
    if request.method == "POST":
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        code = payload.get("code", code)
        state = payload.get("state", state)
    if not code:
        return JsonResponse({"error": "Fayda authorization code is required"}, status=400)
    if state and request.session.get("fayda_oauth_state") and state != request.session.get("fayda_oauth_state"):
        return JsonResponse({"error": "Fayda state did not match"}, status=400)

    try:
        token_request = Request(
            token_url,
            data=urlencode(
                {
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        )
        with urlopen(token_request, timeout=10) as response:
            token_payload = json.loads(response.read())
        access_token = token_payload["access_token"]
        userinfo_request = Request(userinfo_url, headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"})
        with urlopen(userinfo_request, timeout=10) as response:
            claims = json.loads(response.read())
    except (KeyError, json.JSONDecodeError, HTTPError, URLError, TimeoutError):
        return JsonResponse({"error": "Fayda credential could not be verified"}, status=401)

    subject = str(claims.get("sub") or claims.get("FIN") or claims.get("fan") or "").strip()
    if not subject:
        return JsonResponse({"error": "Fayda identity response did not include a subject"}, status=401)
    email = (claims.get("email") or f"{subject}@fayda.local").lower()
    display_name = claims.get("name") or claims.get("given_name") or f"Fayda {subject[-4:]}"
    username = re.sub(r"[^a-z0-9_.-]", "", f"fayda_{subject}".lower())[:30]

    User = get_user_model()
    user, _ = User.objects.get_or_create(username=username, defaults={"email": email})
    if not user.email and email:
        user.email = email
        user.save(update_fields=["email"])
    CreatorProfile.objects.get_or_create(user=user, defaults={"display_name": display_name})
    login(request, user)
    return _token_response(user)


@csrf_exempt
def profile_detail(request):
    try:
        user = user_from_token(request)
    except PermissionError as error:
        return JsonResponse({"error": str(error)}, status=401)
    profile, _ = CreatorProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": user.get_full_name() or user.username},
    )

    if request.method == "GET":
        return JsonResponse({"user": {"id": user.id, "username": user.username, "email": user.email, **_profile_payload(profile)}})
    if request.method not in {"POST", "PATCH"}:
        return JsonResponse({"error": "GET, POST, or PATCH required"}, status=405)

    if request.content_type and request.content_type.startswith("application/json"):
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
    else:
        payload = request.POST

    display_name = payload.get("displayName", profile.display_name).strip()
    profile_type = payload.get("profileType", profile.profile_type)
    if not display_name:
        return JsonResponse({"error": "Display name is required"}, status=400)
    if profile_type not in VALID_PROFILE_TYPES:
        return JsonResponse({"error": "Choose regular user or creator"}, status=400)

    avatar = request.FILES.get("avatar")
    if avatar:
        error = avatar_upload_error(avatar)
        if error:
            return JsonResponse({"error": error}, status=400)
        profile.avatar = avatar

    profile.display_name = display_name
    profile.profile_type = profile_type
    profile.bio = payload.get("bio", profile.bio).strip()
    profile.location = payload.get("location", profile.location).strip()
    disciplines = payload.get("disciplines", "")
    if isinstance(disciplines, str):
        profile.disciplines = [item.strip() for item in disciplines.split(",") if item.strip()][:8]
    profile.save()
    return JsonResponse({"user": {"id": user.id, "username": user.username, "email": user.email, **_profile_payload(profile)}})


@csrf_exempt
def google_sign_in(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    client_id = request.headers.get("X-Google-Client-Id")
    if not client_id:
        return JsonResponse({"error": "Google OAuth is not configured"}, status=503)
    try:
        payload = json.loads(request.body)
        credential = payload["credential"]
        request_data = Request(
            "https://oauth2.googleapis.com/tokeninfo?id_token=" + credential,
            headers={"Accept": "application/json"},
        )
        with urlopen(request_data, timeout=5) as response:
            claims = json.loads(response.read())
    except (KeyError, json.JSONDecodeError, HTTPError, URLError, TimeoutError):
        return JsonResponse({"error": "Google credential could not be verified"}, status=401)
    if claims.get("aud") != client_id or not claims.get("email_verified"):
        return JsonResponse({"error": "Google credential is invalid"}, status=401)

    User = get_user_model()
    email = claims["email"].lower()
    user, _ = User.objects.get_or_create(
        username=email,
        defaults={"email": email, "first_name": claims.get("given_name", ""), "last_name": claims.get("family_name", "")},
    )
    CreatorProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": claims.get("name") or email.split("@")[0]},
    )
    login(request, user)
    return _token_response(user)
