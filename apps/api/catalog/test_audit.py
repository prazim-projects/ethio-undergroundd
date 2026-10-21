"""Regression and budget gates. No production data or external services are used."""
import json
import os
import statistics
import time
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import Client, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.authtoken.models import Token

from catalog.models import CreatorProfile, CreativeWork
from schema import schema


@override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
class AuditSecurityLogicTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(username="audit-owner", password="Audit-strong-123")
        self.creator = CreatorProfile.objects.create(user=self.owner, display_name="Audit Artist", profile_type="creator")
        self.token = Token.objects.create(user=self.owner).key
        self.work = CreativeWork.objects.create(creator=self.creator, title="Public poem", work_type="poetry", file=SimpleUploadedFile("poem.txt", b"A small poem", content_type="text/plain"))
        self.browser = Client(enforce_csrf_checks=True)

    def test_anonymous_play_survives_real_csrf_middleware(self):
        response = self.browser.post(f"/works/{self.work.pk}/play/", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["playCount"], 1)
        self.work.refresh_from_db()
        self.assertEqual(self.work.play_count, 1)

    def test_hostile_origin_cannot_increment(self):
        response = self.browser.post(f"/works/{self.work.pk}/play/", HTTP_ORIGIN="https://evil.example")
        self.assertEqual(response.status_code, 403)
        self.work.refresh_from_db()
        self.assertEqual(self.work.play_count, 0)

    def test_counter_rate_budget(self):
        cache.set("play-rate:127.0.0.1", 120, 60)
        self.assertEqual(self.browser.post(f"/works/{self.work.pk}/play/").status_code, 429)

    def test_counter_get_does_not_mutate(self):
        self.assertEqual(self.client.get(f"/works/{self.work.pk}/play/").status_code, 405)
        self.work.refresh_from_db()
        self.assertEqual(self.work.play_count, 0)

    def test_text_stream_has_scoped_frame_policy(self):
        response = self.client.get(f"/works/{self.work.pk}/stream/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain")
        self.assertIn("inline", response["Content-Disposition"])
        self.assertNotIn("X-Frame-Options", response)
        self.assertIn("http://localhost:3000", response["Content-Security-Policy"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(b"".join(response.streaming_content), b"A small poem")
        response.close()

    def test_pdf_stream_has_pdf_type(self):
        self.work.file = SimpleUploadedFile("portfolio.pdf", b"%PDF-1.4", content_type="application/pdf")
        self.work.save()
        response = self.client.get(f"/works/{self.work.pk}/stream/")
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertNotIn("X-Frame-Options", response)
        response.close()

    def test_private_work_is_absent_from_every_public_path(self):
        self.work.published = False
        self.work.save()
        for suffix in ("stream", "download"):
            self.assertEqual(self.client.get(f"/works/{self.work.pk}/{suffix}/").status_code, 404)
        self.assertEqual(self.client.post(f"/works/{self.work.pk}/play/").status_code, 404)
        result = schema.execute(f'{{ getWork(id: "{self.work.pk}") {{ title }} getCreator(publicId: "{self.creator.public_id}") {{ works {{ title }} }} }}')
        self.assertIsNone(result.errors)
        self.assertIsNone(result.data["getWork"])
        self.assertEqual(result.data["getCreator"]["works"], [])

    def test_raw_private_media_is_blocked(self):
        self.work.published = False
        self.work.save()
        self.assertEqual(self.client.get('/media/' + self.work.file.name).status_code, 404)

    def test_other_creator_cannot_edit(self):
        other = User.objects.create_user(username="other-creator")
        token = Token.objects.create(user=other).key
        response = self.client.post(f"/works/{self.work.pk}/settings/", data=json.dumps({"title": "Stolen"}), content_type="application/json", HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(response.status_code, 404)
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Public poem")

    def test_private_management_requires_authentication(self):
        self.assertEqual(self.client.get("/works/mine/").status_code, 401)
        self.assertEqual(self.client.post(f"/works/{self.work.pk}/settings/", {}).status_code, 401)

    def test_inactive_token_is_rejected(self):
        self.owner.is_active = False
        self.owner.save()
        self.assertEqual(self.client.get("/works/mine/", HTTP_AUTHORIZATION=f"Token {self.token}").status_code, 401)

    def test_non_finite_and_out_of_range_prices_are_rejected(self):
        for price in ("NaN", "Infinity", "-Infinity", "-1", "1000000"):
            with self.subTest(price=price):
                response = self.client.post(f"/works/{self.work.pk}/settings/", data=json.dumps({"isPayable": True, "priceEtb": price}), content_type="application/json", HTTP_AUTHORIZATION=f"Token {self.token}")
                self.assertEqual(response.status_code, 400)

    def test_non_object_settings_return_validation_error(self):
        self.assertEqual(self.client.post(f"/works/{self.work.pk}/settings/", data="[]", content_type="application/json", HTTP_AUTHORIZATION=f"Token {self.token}").status_code, 400)

    def test_missing_download_does_not_increment(self):
        self.work.file = "works/missing.txt"
        self.work.save()
        self.assertEqual(self.client.get(f"/works/{self.work.pk}/download/").status_code, 404)
        self.work.refresh_from_db()
        self.assertEqual(self.work.download_count, 0)

    def test_executable_upload_rejected(self):
        response = self.client.post("/works/upload/", {"title": "Bad file", "workType": "other", "file": SimpleUploadedFile("exploit.html", b"<script>alert(1)</script>", content_type="text/plain")}, HTTP_AUTHORIZATION=f"Token {self.token}")
        self.assertEqual(response.status_code, 400)

    def test_google_audience_is_server_configured(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
            self.assertEqual(self.client.post("/auth/google/", data='{"credential":"fake"}', content_type="application/json", HTTP_X_GOOGLE_CLIENT_ID="attacker-app").status_code, 503)

    def test_fayda_requires_session_bound_state(self):
        env = {key: "https://example.com" for key in ("FAYDA_CLIENT_ID", "FAYDA_CLIENT_SECRET", "FAYDA_REDIRECT_URI", "FAYDA_TOKEN_URL", "FAYDA_USERINFO_URL")}
        with patch.dict(os.environ, env), patch("catalog.auth.urlopen") as fetch:
            response = self.client.get("/auth/fayda/callback/?code=bad-code")
            self.assertEqual(response.status_code, 400)
            fetch.assert_not_called()

    def test_graphql_rejects_excessive_nesting(self):
        query = "{ popularCreatives { works { creator { works { creator { works { title } } } } } } }"
        response = self.client.post("/graphql/", {"query": query}, content_type="application/json")
        self.assertIn("errors", response.json())
        self.assertNotIn("data", response.json())


class AuditPerformanceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(username="benchmark")
        creator = CreatorProfile.objects.create(user=user, display_name="Benchmark", profile_type="creator")
        CreativeWork.objects.bulk_create([CreativeWork(creator=creator, title=f"Work {i}", work_type="music", file="works/test.mp3", play_count=i) for i in range(250)])

    def test_catalog_query_budget_and_latency(self):
        query = "{ popularCreatives(limit: 12) { displayName username } loadPopularWorks(limit: 12) { title playCount creator { username } } searchWorks(limit: 60) { title creator { username } } }"
        with CaptureQueriesContext(connection) as queries:
            result = schema.execute(query)
        self.assertIsNone(result.errors)
        self.assertLessEqual(len(queries), 3, "Catalog must not regress to per-row queries")
        timings = []
        for _ in range(20):
            start = time.perf_counter()
            result = schema.execute(query)
            timings.append((time.perf_counter() - start) * 1000)
            self.assertIsNone(result.errors)
        p95 = sorted(timings)[18]
        self.assertLess(p95, 500, "Local SQLite p95 budget: 500ms on 250 works")
        report = {"fixtureWorks": 250, "runs": 20, "queries": len(queries), "medianMs": round(statistics.median(timings), 2), "p95Ms": round(p95, 2), "budgetMs": 500}
        destination = Path(__file__).resolve().parents[3] / ".tmp/audit"
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "api-performance.json").write_text(json.dumps(report, indent=2))
        print("API BENCHMARK", json.dumps(report))

    def test_large_limit_is_capped_and_ordered(self):
        result = schema.execute("{ loadPopularWorks(limit: 100000) { playCount } }")
        self.assertIsNone(result.errors)
        self.assertEqual(len(result.data["loadPopularWorks"]), 100)
        self.assertEqual(result.data["loadPopularWorks"][0]["playCount"], 249)

    def test_negative_limits_are_bounded(self):
        result = schema.execute("{ searchWorks(limit: -1) { title } }")
        self.assertIsNone(result.errors)
        self.assertEqual(len(result.data["searchWorks"]), 1)
