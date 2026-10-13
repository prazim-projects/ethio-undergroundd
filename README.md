# Underground Musician Catalog

This repository is a Turborepo-based full stack app for discovering underground musicians.

The project is split into a Vue/Nuxt frontend, a Django GraphQL API, and shared packages used by both. Day 1, Day 2, and Day 3 milestones are complete.

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

## Current Backend State (Day 1 + Day 2)

The API is set up in `apps/api` with these pieces:

- `api_root/settings.py` adds `catalog`, `corsheaders`, and `graphene_django`.
- `api_root/settings.py` also enables CORS for local development.
- `api_root/settings.py` points Graphene to `schema.schema`.
- `api_root/urls.py` exposes GraphQL with GraphiQL at `/graphql`.
- `catalog/models.py` defines the core musician data model.
- `catalog/migrations/0001_initial.py` creates the initial tables.
- `catalog/admin.py` registers the models in Django Admin.
- `schema.py` defines GraphQL object types and queries.

Models:

- `Artist`: `name`, `genre`, `bio`, `location`
- `Album`: `artist` foreign key, `title`, `release_date`, `cover_image`
- `Track`: `album` foreign key, `title`, `audio_file`

Implemented GraphQL queries:

- `allArtists`
- `artistDetail(id)`
- `tracksByGenre(genre)`

## Current UI Package State (Day 3)

The shared `packages/ui` package now includes:

- `artist-card.vue`
- `genre-badge.vue`
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

### 6. Run the workspace frontend apps

From the repo root in another terminal:

```powershell
npm run dev
```

Turbo will start each app that exposes a `dev` script.

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

The next planned step is Day 4:

- install and configure Apollo client in frontend app
- add frontend GraphQL query files
- connect discovery UI to live endpoint `http://localhost:8000/graphql`
