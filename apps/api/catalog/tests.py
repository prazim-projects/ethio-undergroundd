import json
from datetime import date
from pathlib import Path
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.test import TestCase

from catalog.models import Album, Artist, CreativeWork, CreatorProfile, Track
from schema import schema


class CatalogGraphQLTests(TestCase):
	def setUp(self):
		artist = Artist.objects.create(
			name="Night Echo",
			genre="Indie",
			bio="Live from basements",
			location="Addis Ababa",
		)
		album = Album.objects.create(
			artist=artist,
			title="Street Signals",
			release_date=date(2025, 1, 10),
		)
		Track.objects.create(album=album, title="Static Bloom")

	def test_all_artists_returns_catalog_artists(self):
		result = schema.execute("{ allArtists { name genre location } }")

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["allArtists"][0]["name"], "Night Echo")

	def test_artist_detail_returns_one_artist(self):
		artist = Artist.objects.get(name="Night Echo")
		result = schema.execute(f'{{ artistDetail(id: "{artist.pk}") {{ name }} }}')

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["artistDetail"]["name"], "Night Echo")

	def test_tracks_by_genre_returns_matching_tracks(self):
		result = schema.execute('{ tracksByGenre(genre: "Indie") { title } }')

		self.assertIsNone(result.errors)
		if result.data is None:
			self.fail("GraphQL returned no data")
		self.assertEqual(result.data["tracksByGenre"][0]["title"], "Static Bloom")

	def test_graphql_endpoint_accepts_json_post_without_csrf_token(self):
		response = self.client.post(
			"/graphql",
			data='{"query":"{ allArtists { name } }"}',
			content_type="application/json",
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()["data"]["allArtists"][0]["name"], "Night Echo")


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
	def test_track_download_uses_attachment_response(self):
		artist = Artist.objects.create(name="Night Echo", genre="Indie", location="Addis Ababa")
		album = Album.objects.create(artist=artist, title="Street Signals", release_date=date(2025, 1, 10))
		track = Track.objects.create(
			album=album,
			title="Static Bloom",
			audio_file=SimpleUploadedFile("static-bloom.mp3", b"audio bytes", content_type="audio/mpeg"),
		)

		response = self.client.get(f"/tracks/{track.pk}/download/")

		self.assertEqual(response.status_code, 200)
		self.assertIn("attachment", response.headers["Content-Disposition"])
		self.assertIn("static-bloom.mp3", response.headers["Content-Disposition"])
