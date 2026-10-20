import json
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .models import CreativeWork, CreatorProfile, UploadSession


@override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
class MobileUploadTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.settings_override = override_settings(PRIVATE_UPLOAD_ROOT=Path(self.temp.name))
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = User.objects.create(username="creator")
        self.profile = CreatorProfile.objects.create(user=self.user, display_name="Creator", profile_type="creator")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {Token.objects.create(user=self.user).key}"}

    def start(self, **changes):
        data = {"filename": "song.mp3", "size": 8, "contentType": "audio/mpeg", "workType": "music", **changes}
        return self.client.post("/works/uploads/", json.dumps(data), content_type="application/json", **self.auth)

    def chunk(self, path, data, offset):
        return self.client.patch(path, data, content_type="application/octet-stream", HTTP_UPLOAD_OFFSET=str(offset), **self.auth)

    def test_resume_after_lost_response_and_complete_exactly_once(self):
        session = self.start().json()
        path = f'/works/uploads/{session["id"]}/'
        self.assertEqual(self.chunk(path, b"abcd", 0).json()["offset"], 4)
        # The client did not receive the first response and retransmitted.
        conflict = self.chunk(path, b"abcd", 0)
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["offset"], 4)
        self.assertEqual(self.client.get(path, **self.auth).json()["offset"], 4)
        self.assertEqual(self.client.post(path, {"title": "Song"}, **self.auth).status_code, 409)
        self.assertEqual(self.chunk(path, b"efgh", 4).json()["offset"], 8)
        self.assertEqual(self.client.post(path, {"title": ""}, **self.auth).status_code, 400)
        complete = self.client.post(path, {"title": "Song"}, **self.auth)
        self.assertEqual(complete.status_code, 201)
        work = CreativeWork.objects.get()
        self.assertEqual(work.file.read(), b"abcdefgh")
        retried = self.client.post(path, {"title": "Song again"}, **self.auth)
        self.assertEqual(retried.json()["workId"], work.pk)
        self.assertEqual(CreativeWork.objects.count(), 1)
        self.assertFalse((Path(self.temp.name) / f'{session["id"]}.part').exists())

    def test_uploads_are_owned_and_creator_only(self):
        session = self.start().json()
        path = f'/works/uploads/{session["id"]}/'
        self.assertEqual(self.client.get(path).status_code, 401)
        other = User.objects.create(username="other")
        other_auth = {"HTTP_AUTHORIZATION": f"Token {Token.objects.create(user=other).key}"}
        for method in (self.client.get, self.client.patch, self.client.post, self.client.delete):
            self.assertEqual(method(path, **other_auth).status_code, 404)
        self.profile.profile_type = "listener"
        self.profile.save()
        self.assertEqual(self.chunk(path, b"abcd", 0).status_code, 403)
        self.assertEqual(self.start().status_code, 403)

    def test_size_type_quota_and_expiry_limits(self):
        for changes in ({"size": 0}, {"size": 2**31}, {"size": "8"}, {"filename": "bad.exe"},
                        {"filename": ""}, {"filename": "../"}, {"workType": "poetry"}, {"contentType": "text/html"}):
            self.assertEqual(self.start(**changes).status_code, 400, changes)
        first = self.start().json()
        self.start(); self.start()
        self.assertEqual(self.start().status_code, 429)
        path = f'/works/uploads/{first["id"]}/'
        self.assertEqual(self.chunk(path, b"123456789", 0).status_code, 400)
        with patch("catalog.resumable.CHUNK_SIZE", 2):
            self.assertEqual(self.chunk(path, b"1234", 0).status_code, 400)
        self.chunk(path, b"abcd", 0)
        UploadSession.objects.filter(pk=first["id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(path, **self.auth).status_code, 410)
        call_command("cleanup_uploads", verbosity=0)
        self.assertFalse(UploadSession.objects.filter(pk=first["id"]).exists())
        self.assertFalse((Path(self.temp.name) / f'{first["id"]}.part').exists())

    def test_uncommitted_trailing_bytes_are_replaced_and_cancel_removes_data(self):
        session = self.start().json()
        path = f'/works/uploads/{session["id"]}/'
        self.chunk(path, b"abcd", 0)
        part = Path(self.temp.name) / f'{session["id"]}.part'
        with part.open("ab") as handle:
            handle.write(b"uncommitted")
        self.chunk(path, b"efgh", 4)
        self.assertEqual(part.read_bytes(), b"abcdefgh")
        self.assertEqual(self.client.delete(path, **self.auth).status_code, 200)
        self.assertFalse(part.exists())
        self.assertEqual(self.client.get(path, **self.auth).status_code, 404)

    def test_manage_catalog_is_paginated_and_isolated(self):
        for index in range(23):
            CreativeWork.objects.create(creator=self.profile, title=f"Work {index}", work_type="poetry", file="works/poem.txt")
        stranger = CreatorProfile.objects.create(user=User.objects.create(username="stranger"), display_name="Stranger", profile_type="creator")
        CreativeWork.objects.create(creator=stranger, title="Private stranger work", work_type="poetry", file="works/private.txt")
        first = self.client.get("/works/mine/?page=1&pageSize=20", **self.auth)
        second = self.client.get("/works/mine/?page=2&pageSize=20", **self.auth).json()
        self.assertEqual(first.json()["total"], 23)
        self.assertEqual(len(first.json()["works"]), 20)
        self.assertEqual(len(second["works"]), 3)
        self.assertTrue(first.json()["hasMore"])
        self.assertFalse(second["hasMore"])
        self.assertFalse(set(w["id"] for w in first.json()["works"]) & set(w["id"] for w in second["works"]))
        self.assertEqual(first["Cache-Control"], "private, no-store")
        self.assertEqual(self.client.get("/works/mine/?page=0", **self.auth).status_code, 400)
        self.assertEqual(self.client.get("/works/mine/?pageSize=nope", **self.auth).status_code, 400)

    def test_native_chunk_cors_preflight(self):
        response = self.client.options("/works/uploads/", HTTP_ORIGIN="https://localhost",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="PATCH", HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,upload-offset")
        self.assertEqual(response["access-control-allow-origin"], "https://localhost")
        self.assertIn("upload-offset", response["access-control-allow-headers"])
