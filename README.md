# Underground Musician Catalog

This repository is a Turborepo-based full stack app for discovering underground musicians.

The project is split into a Vue/Vite frontend, a Django GraphQL API, and shared packages used by both. Days 1–7 are implemented.

Creators can now create an account, sign in with email/password or Google, and publish music, photography, visual art, videography, poetry, or other files.

Android/Capacitor setup, native camera capture, private offline downloads, image compression, resumable media uploads, and paginated catalog management are documented in [the web app runbook](apps/web/README.md). The current catalog uses `CreatorProfile` and `CreativeWork`; the Artist/Album/Track descriptions below are historical.

## Tech Stack

- Turborepo for workspace orchestration
- Nuxt 3 / Vue for the frontend
- Django 5 for the API
- Graphene-Django for GraphQL
- Tailwind CSS for UI styling

## Repository Layout

- `apps/api` is the Django backend.
- `apps/web` is the main Nuxt frontend.
- `apps/docs` is the Nuxt docs/demo app.
- `packages/ui` is the shared Vue component library.
- `packages/tsconfig` and `packages/eslint-config-custom` contain shared TypeScript and lint settings.

## How Turborepo Works Here

The root `package.json` defines workspace-level scripts that forward into each app/package.

- `npm run dev` runs the `dev` script in every workspace that defines one.
- `npm run build` runs the `build` script in every workspace that defines one.
- `npm run lint` runs lint tasks across the workspace.

The root `turbo.json` configures task behavior:

- `build` depends on dependency builds and caches Nuxt outputs.
- `lint` is a standard workspace lint task.
- `dev` is persistent and uncached so it can keep servers running.

In practice, this means Turbo lets you manage the repo as one project while still keeping each app independent.

## Current Backend State (Days 1, 2, and 6)

The API is set up in `apps/api` with these pieces:

- `api_root/settings.py` adds `catalog`, `corsheaders`, and `graphene_django`.
- `api_root/settings.py` also enables CORS for local development.
- `api_root/settings.py` points Graphene to `schema.schema`.
- `api_root/urls.py` exposes GraphQL with GraphiQL at `/graphql`.
- `api_root/urls.py` serves uploaded development media at `/media/`.
- `catalog/models.py` defines the core musician data model.
- `catalog/migrations/0001_initial.py` creates the initial tables.
- `catalog/admin.py` registers the models in Django Admin.
- `schema.py` defines GraphQL object types and queries.
- `catalog/auth.py` provides email/password and Google credential sign-in.
- `catalog/uploads.py` provides authenticated multipart work uploads.

Models:

- `Artist`: `name`, `genre`, `bio`, `location`
- `Album`: `artist` foreign key, `title`, `release_date`, `cover_image`
- `Track`: `album` foreign key, `title`, `audio_file`
- `CreatorProfile`: authenticated user profile, disciplines, location, and avatar.
- `CreativeWork`: creator-owned file with a title, discipline, description, and publication state.

Implemented GraphQL queries:

- `allArtists`
- `artistDetail(id)`
- `tracksByGenre(genre)`
- `allWorks(workType)`
- `currentCreator`

Authentication endpoints:

- `POST /auth/sign-up/`
- `POST /auth/sign-in/`
- `POST /auth/google/`

Upload endpoint:

- `POST /works/upload/` with `Authorization: Token <token>` and multipart fields `title`, `workType`, `description`, and `file`.

Supported work types:

- `music`
- `photography`
- `visual_art`
- `videography`
- `poetry`
- `other`

Media configuration:

- Cover art is stored under `media/covers/`.
- Audio files are stored under `media/tracks/`.
- Django serves both from `http://127.0.0.1:8000/media/` while `DEBUG=True`.

## Current UI Package State (Days 3 and 6)

The shared `packages/ui` package now includes:

- `artist-card.vue`
- `genre-badge.vue`
- `audio-player.vue`
- `track-list.vue`
- exports in `packages/ui/index.ts`
- Tailwind setup in `packages/ui/tailwind.config.cjs` and `packages/ui/postcss.config.cjs`
- shared Tailwind entry CSS in `packages/ui/src/tailwind.css`

Use in a consumer app:

```ts
import { ArtistCard, GenreBadge } from "ui";
```

Tailwind build helpers in `packages/ui`:

```powershell
npm run tailwind:build
npm run tailwind:watch
```

## Local Setup

### Prerequisites

- Node.js installed
- Python installed
- Git installed

The backend uses the virtual environment already present in `apps/api/venv-underground`.

### 1. Install Node dependencies

From the repo root:

```powershell
npm install
```

### 2. Install Python dependencies

From `apps/api`:

```powershell
venv-underground\Scripts\python.exe -m pip install -r requirements.txt
```

This installs:

- Django
- django-cors-headers
- graphene-django
- Pillow

### 3. Apply database migrations

From `apps/api`:

```powershell
venv-underground\Scripts\python.exe manage.py migrate
```

This creates the SQLite schema used by the catalog models.

### 4. Create an admin user

From `apps/api`:

```powershell
venv-underground\Scripts\python.exe manage.py createsuperuser
```

This lets you log into Django Admin at `/admin/`.

### 5. Run the Django backend

From `apps/api`:

```powershell
npm run dev
```

That runs:

```powershell
venv-underground\Scripts\python.exe manage.py runserver 8000
```

Backend URL:

- `http://127.0.0.1:8000/`

Admin URL:

- `http://127.0.0.1:8000/admin/`

GraphQL URL:

- `http://127.0.0.1:8000/graphql`
- `http://127.0.0.1:8000/graphql/`

The GraphQL view is CSRF-exempt because it is a JSON API endpoint consumed by the Vite frontend. Django form/admin requests remain protected by the normal CSRF middleware.

### 6. Run the workspace frontend apps

From the repo root in another terminal:

```powershell
npm run dev
```

Turbo will start each app that exposes a `dev` script.

The main Vite web app is available at:

- `http://127.0.0.1:3000/`

The web app reads the API from `VITE_API_URL`, defaulting to:

- `http://127.0.0.1:8000/graphql/`

To use another API URL, create `apps/web/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8000/graphql/
```

To enable the Google button, add your Google OAuth web client ID to the same file:

```env
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

The Google credential is verified server-side by Django. A client ID alone is not enough to authenticate a user.

## Useful Commands

From `apps/api`:

```powershell
npm run makemigrations
npm run migrate
npm run dev
```

From the repo root:

```powershell
npm run dev
npm run build
npm run lint
npm run test
```

For the local Postgres service planned for later production configuration:

```powershell
npm run db:up
npm run db:down
```

## How To Test Day 2 GraphQL

### 1. Start backend

From `apps/api`:

```powershell
npm run dev
```

### 2. Test in GraphiQL

Open:

- `http://127.0.0.1:8000/graphql`

Run:

```graphql
query {
	allArtists {
		id
		name
		genre
		location
	}
}
```

Run:

```graphql
query {
	artistDetail(id: 1) {
		id
		name
		genre
	}
}
```

Run:

```graphql
query {
	tracksByGenre(genre: "Indie") {
		id
		title
		album {
			title
			artist {
				name
			}
		}
	}
}
```

### 3. If DB is empty, seed sample data

From `apps/api`:

```powershell
venv-underground\Scripts\python.exe manage.py shell -c "from catalog.models import Artist,Album,Track; from datetime import date; from django.core.files.base import ContentFile; a,_=Artist.objects.get_or_create(name='Night Echo',defaults={'genre':'Indie','bio':'Live from basements','location':'Addis Ababa'}); album,_=Album.objects.get_or_create(artist=a,title='Street Signals',defaults={'release_date':date(2025,1,10)}); t,_=Track.objects.get_or_create(album=album,title='Static Bloom'); (not t.audio_file) and t.audio_file.save('static-bloom.txt', ContentFile(b'demo audio placeholder'), save=True); print('seeded')"
```

### 4. Test GraphQL over HTTP

From another terminal:

```powershell
curl -X POST http://127.0.0.1:8000/graphql -H "Content-Type: application/json" -d '{"query":"{ allArtists { id name genre location } }"}'
```

If the browser previously showed `403 Forbidden`, stop and restart the Django server after pulling this change. Both `/graphql` and `/graphql/` now accept the frontend JSON POST request.

## API Tests

Run the Django unit tests:

```powershell
cd apps/api
venv-underground\Scripts\python.exe manage.py test
```

The tests cover `allArtists`, `artistDetail`, and `tracksByGenre` against an isolated test database.

They also cover creator sign-up, sign-in, anonymous upload rejection, and authenticated poetry upload.

Run the same checks through the workspace:

```powershell
npm run test
```

## What Is Implemented

- Day 3: shared `ArtistCard` and `GenreBadge` components with Tailwind setup.
- Day 4: typed GraphQL client and catalog query in the Vite frontend. The Vite app uses `fetch` because this workspace is not a Nuxt app and therefore does not use `@nuxtjs/apollo`.
- Day 5: artist discovery page with search and genre filtering.
- Day 6: media URL support, HTML5 audio player, track list, and track selection.
- Day 7: Turbo test task, Docker Compose Postgres service, API checks, and completed runbook.
- The shared `Page` component is synchronous, so Vue no longer reports an async setup/Suspense warning in the docs app.

## Working With the Repo

- Put backend changes in `apps/api`.
- Put frontend page and Nuxt work in `apps/web`.
- Put reusable UI pieces in `packages/ui`.
- Keep shared TypeScript or lint rules in the `packages/*` config folders.

## GitHub / Push Notes

The `.gitignore` is configured to keep local-only files out of the repo, including:

- Node modules
- Turbo cache
- Python bytecode
- Local Django SQLite database
- Virtual environments
- Editor settings like `.vscode/`

If VS Code shows import warnings for Django or Graphene, use the API interpreter:

- `apps/api/venv-underground/Scripts/python.exe`

## What To Do Next

The next production hardening steps are authentication, PostgreSQL settings in Django, upload validation, and deployment configuration.
