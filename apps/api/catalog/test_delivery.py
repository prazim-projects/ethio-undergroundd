import base64
import json

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token

from .models import CreativeWork, CreatorProfile

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==')


@override_settings(DEBUG=False, STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
class MediaDeliveryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='delivery')
        self.profile = CreatorProfile.objects.create(user=self.user, display_name='Artist', profile_type='creator')
        self.auth = {'HTTP_AUTHORIZATION': f'Token {Token.objects.create(user=self.user).key}'}
        self.work = CreativeWork.objects.create(creator=self.profile, title='Track', work_type='music',
            file=SimpleUploadedFile('song.mp3', b'0123456789', content_type='audio/mpeg'))
        self.url = f'/works/{self.work.pk}/stream/'

    def body(self, response):
        result = b''.join(response.streaming_content) if response.streaming else response.content
        response.close()
        return result

    def test_range_seek_suffix_and_bounded_end(self):
        for header, expected, content_range in [('bytes=2-5', b'2345', 'bytes 2-5/10'),
                ('bytes=7-', b'789', 'bytes 7-9/10'), ('bytes=-3', b'789', 'bytes 7-9/10'),
                ('bytes=8-100', b'89', 'bytes 8-9/10')]:
            response = self.client.get(self.url, HTTP_RANGE=header)
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response['Accept-Ranges'], 'bytes')
            self.assertEqual(response['Content-Range'], content_range)
            self.assertEqual(int(response['Content-Length']), len(expected))
            self.assertEqual(self.body(response), expected)

    def test_head_conditional_and_unsatisfiable(self):
        response = self.client.head(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Length'], '10')
        self.assertEqual(self.body(response), b'')
        self.assertEqual(self.client.get(self.url, HTTP_IF_NONE_MATCH=response['ETag']).status_code, 304)
        ranged = self.client.get(self.url, HTTP_RANGE='bytes=2-3', HTTP_IF_RANGE='"old-version"')
        self.assertEqual(ranged.status_code, 200)
        self.assertEqual(self.body(ranged), b'0123456789')
        for header in ('bytes=20-', 'bytes=-0', 'bytes=7-2'):
            invalid = self.client.get(self.url, HTTP_RANGE=header)
            self.assertEqual(invalid.status_code, 416)
            self.assertEqual(invalid['Content-Range'], 'bytes */10')
        for header in ('bytes=0-1,4-5', 'nonsense'):
            ignored = self.client.get(self.url, HTTP_RANGE=header)
            self.assertEqual(ignored.status_code, 200)
            self.body(ignored)

    def test_private_work_is_never_served_even_with_range_or_etag(self):
        self.work.published = False
        self.work.save()
        self.assertEqual(self.client.get(self.url, HTTP_RANGE='bytes=0-1').status_code, 404)
        self.assertEqual(self.client.get('/media/' + self.work.file.name).status_code, 404)

    def test_avatar_upload_and_storage_delivery_with_debug_disabled(self):
        response = self.client.post('/auth/profile/', {'avatar': SimpleUploadedFile('avatar.png', PNG, content_type='image/png')}, **self.auth)
        self.assertEqual(response.status_code, 200)
        path = response.json()['user']['avatar']
        self.assertEqual(self.body(self.client.get(path)), PNG)
        self.assertEqual(self.body(self.client.get(path.replace('/media/', '/images/'))), PNG)
        self.assertEqual(self.client.get('/images/avatars/not-uploaded.png').status_code, 404)
        self.assertEqual(self.client.get('/images/../../api_root/settings.py').status_code, 404)

    def test_edit_artwork_multipart_and_visibility(self):
        path = f'/works/{self.work.pk}/settings/'
        response = self.client.post(path, {'title': 'New title', 'thumbnail': SimpleUploadedFile('cover.png', PNG, content_type='image/png')}, **self.auth)
        self.assertEqual(response.status_code, 200)
        image = response.json()['work']['thumbnail']
        self.assertEqual(self.body(self.client.get(image)), PNG)
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, 'New title')
        self.work.published = False; self.work.save()
        self.assertEqual(self.client.get(image).status_code, 404)
        self.assertEqual(self.body(self.client.get(image, **self.auth)), PNG)
        self.assertEqual(self.client.post(path, {'thumbnail': SimpleUploadedFile('bad.svg', b'<svg/>', content_type='image/svg+xml')}, **self.auth).status_code, 400)

    def test_small_upload_with_artwork_replays_success_without_duplicate_work(self):
        def upload(title='New song', **auth):
            return self.client.post('/works/upload/', {'title': title, 'workType': 'music',
                'file': SimpleUploadedFile('new.mp3', b'audio', content_type='audio/mpeg'),
                'thumbnail': SimpleUploadedFile('cover.png', PNG, content_type='image/png')},
                HTTP_IDEMPOTENCY_KEY='lost-response', **(auth or self.auth))
        first, replay = upload(), upload()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(first.json()['id'], replay.json()['id'])
        self.assertEqual(replay['Idempotency-Replayed'], 'true')
        self.assertEqual(CreativeWork.objects.count(), 2)
        self.assertEqual(upload('Different request').status_code, 409)
        other = User.objects.create(username='other-delivery')
        CreatorProfile.objects.create(user=other, display_name='Other', profile_type='creator')
        self.assertEqual(upload(HTTP_AUTHORIZATION=f'Token {Token.objects.create(user=other).key}').status_code, 201)

    def test_json_edits_remain_compatible_and_idempotent(self):
        path = f'/works/{self.work.pk}/settings/'
        for _ in range(2):
            response = self.client.post(path, json.dumps({'title': 'Retry safe'}), content_type='application/json',
                HTTP_IDEMPOTENCY_KEY='edit-once', **self.auth)
            self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Idempotency-Replayed'], 'true')
