# Unifit.hyd

Public website, member PWA and staff dashboard for Unifit.hyd. The plan lives in
[docs/Unifit_hyd_PRD_v3.0.md](docs/Unifit_hyd_PRD_v3.0.md); requirement IDs from it
(for example BKG-1) are used in code comments and commits.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | React + Vite PWA: landing page (3D hero) and, next, the member and staff app |
| `apps/api` | Node + Express + Prisma (MySQL 8) API |
| `apps/api/src/domain` | Membership, credits and UPI rules as pure, tested functions (PRD section 7) |
| `brand/logo` | Vector logo set (SVG) generated from the artwork |
| `brand/tools/gen-logo.mjs` | Rebuilds the SVG set and the PWA icons (`npm run logo`) |
| `docs` | PRDs and original logo artwork |

## Run locally

```bash
npm install
```

```bash
npm run dev:web
```

The website runs at http://localhost:5173 and works without the API (the timetable shows "coming soon" and the trial form reports that it could not send).

For the API you need MySQL 8. Copy `apps/api/.env.example` to `apps/api/.env`, set `DATABASE_URL`, then:

```bash
npm run db:migrate -w @unifit/api
```

```bash
npm run db:seed -w @unifit/api
```

```bash
npm run dev:api
```

## Tests

```bash
npm test -w @unifit/api
```

## Brand

Colours are tokens in `apps/web/src/styles/tokens.css` (PRD section 10). Use `Mark`, `Wordmark` and `LogoLockup` from `apps/web/src/brand/Logo.tsx` in the app; they follow the light and dark themes. For other uses (print, social, email) take the files in `brand/logo`:

| File | Use |
| --- | --- |
| `unifit-logo-stacked-dark.svg` / `-light.svg` | Full logo with tagline |
| `unifit-logo-horizontal-dark.svg` / `-light.svg` | Headers, email, letterheads |
| `unifit-mark-dark.svg` / `-light.svg` | The "U" alone |
| `unifit-mark-mono.svg` | One colour (takes the CSS `color`) |
| `unifit-wordmark-dark.svg` / `-light.svg` | Text only |
| `unifit-icon-dark.svg` / `-light.svg` | App icon tiles |
| `unifit-icon-maskable.svg`, `favicon.svg` | Android maskable icon, browser tab |

The wordmark is rebuilt from Poppins ExtraBold Italic, which matches the artwork closely but not exactly. Ask the designer for the original vector file and replace these if it differs.
