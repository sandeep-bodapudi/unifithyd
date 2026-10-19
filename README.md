# Unifit.hyd

Public website, member PWA and staff dashboard for Unifit.hyd. The plan lives in
[docs/Unifit_hyd_PRD_v3.0.md](docs/Unifit_hyd_PRD_v3.0.md); requirement IDs from it
(for example BKG-1) are used in code comments and commits.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | React + Vite PWA: 3D landing page and the member, coach and admin app (`/app`) |
| `apps/api` | Node + Express + Prisma (MySQL 8) API |
| `apps/api/src/domain` | Membership, credits and UPI rules as pure, tested functions (PRD section 7) |
| `brand/logo` | Vector logo set (SVG) generated from the artwork |
| `brand/tools/gen-logo.mjs` | Rebuilds the SVG set and the PWA icons (`npm run logo`) |
| `docs` | PRDs and original logo artwork |

## Run locally

You need Node 24 and MySQL 8 (or MariaDB). On the development PC a project-only MariaDB runs on port 3307 with its data in the git-ignored `.data/` folder (`npm run db:local` starts it).

```bash
npm install
```

Copy `apps/api/.env.example` to `apps/api/.env`, set `DATABASE_URL` and a long random `APP_SECRET`. Then create the tables, load the plans and create the owner account:

```bash
npm run db:migrate -w @unifit/api
```

```bash
npm run db:seed -w @unifit/api
```

```bash
npm run owner:create -w @unifit/api -- --name "Owner Name" --email owner@example.com --phone 9876543210
```

The owner command prints a one-time password. Start both servers:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

- Website: http://localhost:5173
- App for members, coaches and admins: http://localhost:5173/app
- Staff log in with email, then password, then a 6-digit email code. Members log in with an email code only.
- Without `RESEND_API_KEY`, emails (including login codes) are printed in the API console. `DEV_SHOW_CODES=true` also shows codes on screen; never set it in production.

## What is built (PRD v3.0)

| Area | Status |
| --- | --- |
| Accounts, parents and children, consent, two-step staff login, roles | Done |
| Programs, plans, credits, weekly caps, grace, freezes, make-up credits | Done (rules in `apps/api/src/domain`, unit-tested) |
| Timetable: weekly series, one-off classes, closures, changes and cancellations | Done |
| Booking with capacity locking, waitlist, cancellation cut-off | Done |
| Check-in: signed QR, camera scanner, offline queue, class code, manual and walk-in | Done |
| UPI payments: member code in the note, "I have paid" with UTR, verify, receipts, credit notes, reversal, refund | Done |
| UPI change safety: password plus code, 15-minute delay, alerts to all admins | Done |
| Messages: branded email with log and dedupe; reminders, expiry notices, no-shows, daily summary | Done (WhatsApp and SMS fall back to email until a provider is added) |
| Admin: dashboard, members, payments, leads and trials, reports, CSV export, import, staff, settings, logs | Done |
| Website: 3D landing page, live plans and schedule, trial form | Done |
| PWA: install prompt, offline shell, update prompt | Done |
| Legal pages (terms, privacy, waiver, refunds) | Placeholders until the lawyer-reviewed text is ready |
| Receipts as PDF attachments | Receipts are printable pages (Print, then Save as PDF) linked in emails |
| Payment screenshot storage | Local folder; move to object storage for production |

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
