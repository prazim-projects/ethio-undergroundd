# Streaming, artwork and profile-image update

Deploy the backend before updating installed Android clients. Frontend defaults remain
`https://prasim.pythonanywhere.com/graphql/` and `https://ethio-underground.vercel.app/`;
the existing `VITE_API_URL` and `VITE_FRONTEND_URL` build settings override them.

## PythonAnywhere deployment

1. In your existing virtualenv and repository checkout, back up the database and uploaded
   media using your normal backup procedure. For SQLite, use SQLite's backup API rather
   than copying a database while requests are writing to it.
2. Pull the updated `main` branch, then from `apps/api` run:

   ```sh
   python manage.py showmigrations catalog
   python manage.py migrate
   python manage.py check
   ```

   Migration `0009_mutation_receipts` creates a table for replaying successful uploads
   and edits after lost responses. It does not delete existing content. If your server
   is behind older migrations, inspect their operations before applying them.
3. Set `MEDIA_ROOT` in the WSGI environment **before** importing the Django application.
   Use the absolute directory that already contains your `avatars/`, `works/` and
   `work-thumbnails/` directories. The default is `<checkout>/apps/api/media`.
   The console running management commands must use the same setting. For example:

   ```python
   os.environ['MEDIA_ROOT'] = '/home/prasim/your-persistent-media-directory'
   ```

   Replace the example with the actual existing upload directory. Moving to an empty
   directory will not recover old images. Back up and move existing files when changing
   the storage location.
4. In the PythonAnywhere Web tab, keep `/static/` mapped to collected static assets.
   Remove any `/media/` static mapping so Django can enforce published-work visibility
   and serve uploaded files from the configured storage backend. Do not map `/images/`
   as static: the web app uses `/images/avatars/...` and `/images/work-thumbnails/...`
   to avoid stale host-level media mappings.
5. Reload the PythonAnywhere web app. Upload a profile image and confirm the returned
   avatar path, converted from `/media/avatars/...` to `/images/avatars/...`, returns
   HTTP 200. Also verify an existing published work:

   ```sh
   curl -I https://prasim.pythonanywhere.com/works/WORK_ID/stream/
   curl -i -H 'Range: bytes=0-99' https://prasim.pythonanywhere.com/works/WORK_ID/stream/
   ```

   Replace `WORK_ID` with a real numeric ID. Expect `Accept-Ranges: bytes`, and a
   206 response with exactly 100 bytes for the second request (for a file at least
   100 bytes long). Unpublished works must still return 404.

Run `python manage.py cleanup_uploads` daily to remove expired staging uploads and
mutation receipts. Successful mutation receipts live for 24 hours, are scoped to the
authenticated user and request contents, and reject reuse for a different request.

## Behavior and limits

- Audio/video streams support GET, HEAD, byte ranges, seeking, ETags and conditional
  revalidation. They stream bounded chunks rather than reading a complete file into
  server memory. Startup still depends on connection speed and media encoding; MP3/AAC
  with sensible bitrates generally starts sooner than large uncompressed WAV files.
- Online playback of unsaved tracks starts the server request immediately. Saved tracks
  use private local files. Song, queue, pause state, volume and position survive reload
  for seven days, scoped to backend and account. Account changes clear playback recovery.
  A full browser/PWA reload destroys the audio element and briefly stops sound. Recovery
  attempts to resume; browser autoplay restrictions can require tapping Play. OS media
  controls are available where the Media Session API is supported. Pull-to-refresh is
  suppressed on scrolling surfaces where the browser supports overscroll behavior.
- Explicit offline saves share an in-flight download and reuse an existing saved file.
  Browsers stream to private OPFS storage where available, falling back to IndexedDB;
  Android downloads directly to private app storage. The UI shows download progress.
  Initial downloads still require transferring the entire file. A changed media file
  storage path triggers a fresh download; metadata edits alone do not redownload audio.
- Only successful public catalog query results persist, bounded to 24 entries/1.5 MB,
  fresh for one minute and available offline for up to seven days. Unknown/private
  GraphQL operations are not cached. Managed catalog pages persist for one minute under
  a hashed backend/account key. Logout and successful uploads/edits clear query caches.
  Errors are never persisted. Offline cached public metadata may be older than server
  publication changes; streams still enforce current visibility when online.
- Artwork replacement is supported in My works. Uploads remain multipart file uploads;
  `collectstatic` does not publish or recover user-uploaded artwork or profile pictures.
