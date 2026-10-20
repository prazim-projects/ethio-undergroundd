# Ethio Underground web and Android app

The Vue/Vite app runs in a browser/PWA or in Capacitor 8 on Android (application ID `et.ethiounderground.app`). Run commands below from the repository root unless stated otherwise.

## Web

```powershell
npm install
npm run dev --workspace apps/web
npm run build --workspace apps/web
```

Web builds use `dist/`, with an asset-only service worker. API responses, credentials and media are excluded from service-worker caches.

## Install and download from the website

The permanent **Get app** link opens `/install` on every browser, including browsers that do not fire an installation prompt. Supporting browsers show the native PWA installer; the page also has manual Android, iPhone/iPad and desktop instructions. Installation acceptance/dismissal and already-installed state are handled without losing the prompt when navigating between pages. PWA installation guidance follows [MDN's installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The same page links to `/downloads/ethio-underground.apk`, a signed Android preview. APKs use release-mode behavior, with this build machine's persistent Android debug certificate for preview distribution; preserve that key for compatible preview updates. A dedicated production signing key is needed for production/store distribution. No signing key or credential is committed. `public/downloads/android.json` and `ethio-underground.apk.sha256` record the version, size and checksum.

To refresh the downloadable preview after changing app code (Android SDK/JDK required):

```powershell
npm run android:package --workspace apps/web
npm run build --workspace apps/web
```

The native build excludes the web `public/` directory so the downloadable APK is never bundled inside another APK. The PWA service worker does not cache APK downloads. `vercel.json` provides SPA deep links and APK attachment/MIME headers. The download defaults to the configured public frontend; set `VITE_ANDROID_APK_URL` to move the binary to a separate HTTPS host.

## Configurable deployment addresses

Production web and Android builds default to backend `https://prasim.pythonanywhere.com/graphql/` and public frontend `https://ethio-underground.vercel.app/`. Both defaults live in `config/deployment.ts`; request URLs, media URLs, offline-storage namespaces and shared release links derive from them. Native sharing uses the public frontend rather than the device's `https://localhost` origin.

To move either server, override `VITE_API_URL` and `VITE_FRONTEND_URL` in `.env.native.local` for Android or `.env.production.local` / deployment-provider environment variables for the web. See the corresponding `.env.*.example` files. Rebuild and sync Android or redeploy the web app after changing these build-time settings. Native builds validate HTTPS for both URLs, and the API URL must end in `/graphql/`. Local development still defaults to `http://127.0.0.1:8000/graphql/`; set `VITE_API_URL` in `.env.development.local` to use the hosted backend during development.

On the Django server, set `FRONTEND_URL` to the new public frontend origin. If overriding `WEB_ORIGINS`, include both the frontend origin and `https://localhost` for Android. Set `DJANGO_ALLOWED_HOSTS` to the backend hostname, such as `prasim.pythonanywhere.com`, when deploying. These are server environment variables, not Vite variables. Existing downloaded files stay scoped to the original backend when the API changes.

## Appearance

Use **Color theme** in the header to choose **Light**, **Dark**, or **Abyssinia**. The choice persists on the device and is applied before first paint, including offline reloads. Light is the default. Dark uses charcoal/emerald surfaces with bright text. Abyssinia uses warm ink, parchment, gold, green/red tibeb accents, and original Ethiopian anime-inspired creative figures in the sidebar, mobile bottom bar, home hero and footer. All palettes include explicit text, muted text, input, placeholder, button, error, notice, player and preview colors.

The original transparent illustration is `src/assets/abyssinia-creatives.png`, generated with the built-in imagegen tool. The prompt and intended use are recorded in `src/assets/abyssinia-creatives.md`. It is a static app asset and is included in the asset-only offline shell cache.

## Android

Prerequisites: Node 22+, JDK 21, Android Studio with SDK 36 and its build tools. The generated Gradle project is in `android/`; it supports Android 7 (API 24) and newer.

1. The public backend/frontend defaults above are ready to use. To override them, copy `apps/web/.env.native.example` to `apps/web/.env.native.local` and change the URLs. Native builds reject HTTP URLs; `127.0.0.1` on a device refers to that device. For local development, use an HTTPS development endpoint reachable from the device.
2. Include `https://localhost` in the API's `WEB_ORIGINS`. This is already in the Django defaults; retain it if overriding the list. The API must allow `Authorization`, `Content-Type` and `Upload-Offset` headers and PATCH requests.
3. Build and sync, then open Android Studio:

```powershell
npm run android:sync --workspace apps/web
npm run android:open --workspace apps/web
# Or run on a connected device/emulator:
npm run android:run --workspace apps/web
```

Native builds use `dist-native/` and bundle their own shell without registering a service worker. `android:sync` rebuilds web assets and updates plugin wiring. Web assets and generated Capacitor configuration are ignored in Git; always sync after a fresh checkout. The native web bundle uses the configured public backend and frontend. Release signing must be configured in Android Studio for distribution.

Validation includes web/native bundle builds, 41 backend tests and 32 frontend unit tests. Browser coverage includes theme contrast, creator screens, offline storage, previews, player/navigation spacing, install prompt lifecycle, manual instructions, APK bytes and public sharing URLs. Android builds use the normal user Gradle cache; a workspace Gradle cache caused Windows temporary-directory move errors. Camera capture and playback still need physical-device verification. The Android project follows the [Capacitor installation workflow](https://capacitorjs.com/docs/getting-started).

The camera buttons on Publish and Profile call Capacitor Camera with `saveToGallery: false`. Android delegates capture to the system camera app and does not need broad camera or storage permissions. Browser users retain the ordinary file picker. JPEG, PNG and WebP uploads are resized to at most 2048 px (1024 px for covers/avatars) with quality 0.82; PNG transparency is preserved via WebP, and the original is retained if conversion is larger. GIF animation and non-image media are preserved.

## Offline downloads

Sign in, open a work, and select **Save offline**. Use **Offline** in navigation to open or remove saved files, including while disconnected. Audio supports an offline queue. Downloads are scoped to the API host and account, and playback closes on sign-out/account changes.

Android streams downloads directly to `Directory.Data` in its private app sandbox; files are not written to public Downloads or the gallery. Cloud backup and device transfer of app data are disabled. Browser/PWA downloads use explicit IndexedDB blob storage, with a request for persistent storage. This is separate from the asset service-worker cache. Removal deletes both metadata and media. Local data is sandboxed rather than independently encrypted; someone with access to the same unlocked browser profile can inspect browser storage. Browser storage may be evicted if persistence is denied. Uninstalling/clearing app data removes downloads. Saved works remain available locally until removed, even if their online publication changes.

## Resumable uploads and backend setup

Apply the new migration before using uploads:

```powershell
cd apps/api
venv-underground/Scripts/python.exe manage.py migrate
```

Audio/video files of 16 MB or larger use authenticated upload sessions with 2 MB chunks, server-tracked offsets, a 1 GB maximum, and a 7-day lifetime. Failed chunk requests query the committed offset before retrying. Completion is idempotent, so a lost response does not publish twice. **Pause upload** aborts the current request; publish again to continue. After restarting/reloading, reselect the same original file and enter publication details to resume. Covers/details are sent at completion. The device stores only an account-scoped file fingerprint and opaque session ID for recovery, not the media or token in upload-session records. If local storage is disabled, recovery lasts only for the current attempt. **Discard saved upload** deletes the server session. Small uploads use the existing multipart endpoint with its 30 MB limit.

Server staging defaults to `apps/api/private-uploads/`, outside served media. Override `PRIVATE_UPLOAD_ROOT` to a private persistent disk. All workers handling sessions must share that filesystem (including file-lock semantics) and database. The API limits each creator to three incomplete sessions. Configure the reverse proxy for PATCH, request bodies of at least 5 MB (chunk plus optional cover), and appropriate request timeouts. Completed uploads move through the existing media storage and validation flow.

Run this daily in your deployment scheduler to reclaim abandoned uploads:

```powershell
venv-underground/Scripts/python.exe manage.py cleanup_uploads
```

## Manage catalog caching

`GET /works/mine/?page=1&pageSize=20` returns `works`, `page`, `pageSize`, `total` and `hasMore`. Pages have stable descending creation/ID ordering and are capped at 50 records. The UI uses 20 per page, an account-scoped 60-second memory cache (maximum eight pages), request deduplication, and editable copies. Refresh bypasses the cache. Publishing, saving settings, login and logout invalidate it. Private results are never persisted to a shared browser cache.

## Checks

```powershell
npm run test --workspace apps/web
npm run build --workspace apps/web
npm run test:ui --workspace apps/web -- tests/browser/mobile-features.spec.ts
# Theme contrast, configuration and persistence checks:
npm run test:ui --workspace apps/web -- tests/browser/themes.spec.ts
```

Backend tests include upload ownership, interrupted chunks, exact offsets, completion retries, expiry/cleanup, size/quota rules, CORS and catalog pagination. Browser tests exercise offline persistence/playback/deletion, account isolation, pagination/cache refresh, and image dimensions/transparency. Verify camera capture/cancellation, offline audio/video playback and storage removal on a physical Android device before release.
