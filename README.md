# King Family Beach Week

The family's Port Aransas trip, every year in one place: the house and its gate/pool/wifi
codes, who's coming, the dinner rotation, the event calendar, shared expenses, photos,
a group journal, and a map of every house we've rented.

**Live:** https://lukesdyer01.github.io/porta/

## How it's put together

A static React app on GitHub Pages talking directly to Supabase. There is no server.

- **Vite + React + TypeScript**, Tailwind v4, React Router (hash routing — GitHub Pages
  returns 404 for deep paths otherwise)
- **Supabase** for Postgres, auth, and file storage
- **Leaflet + OpenStreetMap** for the house map (no API key, no billing)

### Security model

This repository is public, and the Supabase publishable key ships inside the JavaScript
bundle. That is by design — but it means **every access rule lives in Postgres row-level
security**, with no server to catch a mistake. Two consequences:

1. No codes, addresses, passwords, or personal details belong in this repo. They live in
   the database, behind a login.
2. Sign-up needs either an invited email address or the shared family code, and redeeming
   the code adds that address to the allowlist so access stays individually revocable.
   Because any signed-in member can read the house's gate and wifi codes, **who can sign up
   _is_ the security boundary** — so the code must not be guessable from the site itself.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev
```

## Setup

First-time setup lives in [docs/SETUP.md](docs/SETUP.md).

## Database

Migrations live in `supabase/migrations/`, numbered and applied in order. Apply them by
pasting into the Supabase dashboard SQL editor, or with the Supabase CLI.

After any migration, run the dashboard's **Security Advisor** and treat these as build
failures — each one silently disables the protections above:

- `security_definer_view` — a view that ignores every policy you wrote
- `rls_disabled_in_public` — an unprotected table
- `function_search_path_mutable` — a hijackable helper function

## Deployment

Pushing to `main` builds and publishes via GitHub Actions. A second scheduled workflow
pings the database weekly, because free Supabase projects pause after 7 days idle and this
app sits dormant most of the year.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The publishable / anon key |
