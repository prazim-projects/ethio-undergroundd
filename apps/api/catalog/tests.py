import json
from pathlib import Path
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.test import TestCase

from catalog.models import CreativeWork, CreatorProfile
from schema import schema


@override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
class CatalogGraphQLTests(TestCase):
	def setUp(self):
		user = User.objects.create_user(username="night-echo", email="night@example.com", password="pass")
		self.profile = CreatorProfile.objects.create(
			user=user,
			display_name="Night Echo",
			profile_type=CreatorProfile.ProfileType.CREATOR,
			bio="Live from basements",
			location="Addis Ababa",
		)
		CreativeWork.objects.create(
			creator=self.profile,
			title="Static Bloom",
			work_type=CreativeWork.WorkType.MUSIC,
			description="Indie signal",
			file=SimpleUploadedFile("static-bloom.mp3", b"audio bytes", content_type="audio/mpeg"),
			play_count=7,
		)

	def test_popular_creatives_returns_creator_profiles(self):
		result = schema.execute("{ popularCreatives { displayName location } }")

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["popularCreatives"][0]["displayName"], "Night Echo")

	def test_get_creator_returns_one_creator(self):
		result = schema.execute(f'{{ getCreator(publicId: "{self.profile.public_id}") {{ displayName works {{ title }} }} }}')

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["getCreator"]["displayName"], "Night Echo")
		self.assertEqual(result.data["getCreator"]["works"][0]["title"], "Static Bloom")

	def test_load_popular_works_orders_by_views(self):
		result = schema.execute("{ loadPopularWorks { title playCount } }")

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["loadPopularWorks"][0]["title"], "Static Bloom")

	def test_graphql_endpoint_accepts_json_post_without_csrf_token(self):
		response = self.client.post(
			"/graphql",
			data='{"query":"{ popularCreatives { displayName } }"}',
			content_type="application/json",
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()["data"]["popularCreatives"][0]["displayName"], "Night Echo")


@override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
class CreatorAuthAndUploadTests(TestCase):
	def test_creator_can_sign_up_and_sign_in(self):
		signup = self.client.post(
			"/auth/sign-up/",
			data=json.dumps(
				{
					"displayName": "Maya Lens",
					"username": "maya",
					"email": "maya@example.com",
					"password": "strong-pass-123",
					"confirmPassword": "strong-pass-123",
					"profileType": "creator",
				}
			),
			content_type="application/json",
		)
		self.assertEqual(signup.status_code, 200)
		self.assertTrue(signup.json()["token"])
		self.assertEqual(signup.json()["user"]["profileType"], "creator")
		self.assertTrue(CreatorProfile.objects.filter(display_name="Maya Lens").exists())

		signin = self.client.post(
			"/auth/sign-in/",
			data=json.dumps({"identifier": "maya", "password": "strong-pass-123"}),
			content_type="application/json",
		)
		self.assertEqual(signin.status_code, 200)
		self.assertEqual(signin.json()["user"]["displayName"], "Maya Lens")

	def test_sign_up_rejects_mismatched_passwords(self):
		response = self.client.post(
			"/auth/sign-up/",
			data=json.dumps(
				{
					"displayName": "Maya Lens",
					"username": "maya",
					"email": "maya@example.com",
					"password": "strong-pass-123",
					"confirmPassword": "wrong-pass-123",
					"profileType": "creator",
				}
			),
			content_type="application/json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("Passwords do not match", response.json()["error"])

	def test_only_authenticated_creators_can_upload_work(self):
		anonymous_upload = self.client.post("/works/upload/", {"title": "Nope"})
		self.assertEqual(anonymous_upload.status_code, 401)

		signup = self.client.post(
			"/auth/sign-up/",
			data=json.dumps(
				{
					"displayName": "Poet One",
					"username": "poet",
					"email": "poet@example.com",
					"password": "strong-pass-123",
					"confirmPassword": "strong-pass-123",
					"profileType": "creator",
				}
			),
			content_type="application/json",
		)
		token = signup.json()["token"]
		uploaded = SimpleUploadedFile("poem.txt", b"A small poem", content_type="text/plain")
		response = self.client.post(
			"/works/upload/",
			{"title": "Small Weather", "workType": "poetry", "description": "A first draft", "file": uploaded},
			HTTP_AUTHORIZATION=f"Token {token}",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.json()["workType"], "poetry")
		self.assertEqual(CreativeWork.objects.count(), 1)

	def test_upload_rejects_file_type_mismatch(self):
		signup = self.client.post(
			"/auth/sign-up/",
			data=json.dumps(
				{
					"displayName": "Singer One",
					"username": "singer",
					"email": "singer@example.com",
					"password": "strong-pass-123",
					"confirmPassword": "strong-pass-123",
					"profileType": "creator",
				}
			),
			content_type="application/json",
		)
		token = signup.json()["token"]
		uploaded = SimpleUploadedFile("bad.exe", b"not audio", content_type="application/x-msdownload")
		response = self.client.post(
			"/works/upload/",
			{"title": "Bad Upload", "workType": "music", "file": uploaded},
			HTTP_AUTHORIZATION=f"Token {token}",
		)

		self.assertEqual(response.status_code, 400)

	def test_regular_user_cannot_upload_work(self):
		signup = self.client.post(
			"/auth/sign-up/",
			data=json.dumps(
				{
					"displayName": "Listener One",
					"username": "listener",
					"email": "listener@example.com",
					"password": "strong-pass-123",
					"confirmPassword": "strong-pass-123",
					"profileType": "listener",
				}
			),
			content_type="application/json",
		)
		token = signup.json()["token"]
		uploaded = SimpleUploadedFile("poem.txt", b"A small poem", content_type="text/plain")

		response = self.client.post(
			"/works/upload/",
			{"title": "Small Weather", "workType": "poetry", "file": uploaded},
			HTTP_AUTHORIZATION=f"Token {token}",
		)

		self.assertEqual(response.status_code, 403)

	@override_settings(MEDIA_ROOT=Path(__file__).resolve().parent / "test-media")
	def test_work_download_uses_attachment_response(self):
		user = User.objects.create_user(username="download-creator", email="download@example.com", password="pass")
		profile = CreatorProfile.objects.create(user=user, display_name="Download Creator", profile_type=CreatorProfile.ProfileType.CREATOR)
		work = CreativeWork.objects.create(
			creator=profile,
			title="Static Bloom",
			work_type=CreativeWork.WorkType.MUSIC,
			file=SimpleUploadedFile("static-bloom.mp3", b"audio bytes", content_type="audio/mpeg"),
		)

		response = self.client.get(f"/works/{work.pk}/download/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("attachment", response.headers["Content-Disposition"])
		self.assertIn("static-bloom.mp3", response.headers["Content-Disposition"])

	@override_settings(MEDIA_ROOT=Path(__file__).resolve().parent / "test-media")
	def test_work_stream_opens_text_inline_with_its_content_type(self):
		user = User.objects.create_user(username="stream-creator", email="stream@example.com", password="pass")
		profile = CreatorProfile.objects.create(user=user, display_name="Stream Creator", profile_type=CreatorProfile.ProfileType.CREATOR)
		work = CreativeWork.objects.create(
			creator=profile,
			title="Small Weather",
			work_type=CreativeWork.WorkType.POETRY,
			file=SimpleUploadedFile("small-weather.txt", b"A small poem", content_type="text/plain"),
		)

		response = self.client.get(f"/works/{work.pk}/stream/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.headers["Content-Type"], "text/plain")
		self.assertIn("inline", response.headers["Content-Disposition"])

	@override_settings(MEDIA_ROOT=Path(__file__).resolve().parent / "test-media")
	def test_work_stream_opens_pdf_inline_with_its_content_type(self):
		user = User.objects.create_user(username="pdf-creator", email="pdf@example.com", password="pass")
		profile = CreatorProfile.objects.create(user=user, display_name="PDF Creator", profile_type=CreatorProfile.ProfileType.CREATOR)
		work = CreativeWork.objects.create(
			creator=profile,
			title="Portfolio",
			work_type=CreativeWork.WorkType.VISUAL_ART,
			file=SimpleUploadedFile("portfolio.pdf", b"%PDF-1.4", content_type="application/pdf"),
		)

		response = self.client.get(f"/works/{work.pk}/stream/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.headers["Content-Type"], "application/pdf")
		self.assertIn("inline", response.headers["Content-Disposition"])

	def test_record_work_play_increments_and_returns_the_count(self):
		user = User.objects.create_user(username="count-creator", email="count@example.com", password="pass")
		profile = CreatorProfile.objects.create(user=user, display_name="Count Creator", profile_type=CreatorProfile.ProfileType.CREATOR)
		work = CreativeWork.objects.create(
			creator=profile,
			title="Counted Work",
			work_type=CreativeWork.WorkType.OTHER,
			file=SimpleUploadedFile("counted.txt", b"Count me", content_type="text/plain"),
		)

		first_response = self.client.post(f"/works/{work.pk}/play/")
		second_response = self.client.post(f"/works/{work.pk}/play/")

		self.assertEqual(first_response.status_code, 200)
		self.assertEqual(first_response.json()["playCount"], 1)
		self.assertEqual(second_response.json()["playCount"], 2)
		work.refresh_from_db()
		self.assertEqual(work.play_count, 2)
