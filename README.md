# Unifit.hyd

Public website, member PWA and staff dashboard for Unifit.hyd. The plan lives in
[docs/Unifit_hyd_PRD_v3.0.md](docs/Unifit_hyd_PRD_v3.0.md); requirement IDs from it
(for example BKG-1) are used in code comments and commits.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | React + Vite PWA: 3D landing page and the member, coach and admin app (`/app`) |
| `apps/api` | Node + Express + Prisma API (MySQL 8 / MariaDB or PostgreSQL) |
| `apps/api/src/domain` | Membership, credits and UPI rules as pure, tested functions (PRD section 7) |
| `brand/logo` | Vector logo set (SVG) generated from the artwork |
| `brand/tools/gen-logo.mjs` | Rebuilds the SVG set and the PWA icons (`npm run logo`) |
| `docs` | PRDs and original logo artwork |

## Run locally

You need Node 24 and MySQL 8, MariaDB or PostgreSQL (see [Database](#database)). On the development PC a project-only MariaDB runs on port 3307 with its data in the git-ignored `.data/` folder (`npm run db:local` starts it).

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

## Database

The API runs on MySQL 8 / MariaDB or PostgreSQL. The scheme of `DATABASE_URL` decides which (`mysql://` or `postgresql://`); the driver adapter, Prisma schema and migrations folder follow from it.

| | MySQL / MariaDB | PostgreSQL |
| --- | --- | --- |
| Schema | `apps/api/prisma/schema.prisma` | Generated from it by `prisma.config.ts` (git-ignored) |
| Migrations | `apps/api/prisma/migrations` | `apps/api/prisma/postgresql/migrations` |

- Edit only `prisma/schema.prisma`. Keep to features both databases support (no `@db.MediumText`, `@db.TinyInt`, `mode: 'insensitive'` and so on).
- The generated client is specific to one database. Run `npm run db:generate -w @unifit/api` after switching `DATABASE_URL`.
- Raw SQL differs between the two (identifier quotes, for example). Use the helpers in `apps/api/src/db.ts`: `lockRow` for `SELECT ... FOR UPDATE` and `containsText` for case-insensitive search.
- When you change the schema, create the migration for both databases: run `npm run db:migrate -w @unifit/api -- --name <change>` once with a MySQL URL and once with a PostgreSQL URL, and commit both folders.
- In production, apply migrations with `npm run db:deploy -w @unifit/api`.

## Client demo on Render (free)

`render.yaml` deploys a demo on Render's free plans with made-up sample data: members (adults and a parent with two children), a weekly timetable with past attendance and upcoming bookings, verified and pending UPI payments, receipts and leads.

1. Render dashboard: **New**, then **Blueprint**, then pick this repository and branch. Enter a `DEMO_PASSWORD` (10+ characters) when asked.
2. Wait for the deploy to show **Live** (first build takes about 5 to 10 minutes), then open the service URL.
3. Log in at `/app`. Login codes appear on screen under the code field (`DEMO_MODE`), so no email setup is needed:

   | Role | Email | Password |
   | --- | --- | --- |
   | Owner / admin | `owner@example.com` | your `DEMO_PASSWORD` |
   | Coach | `coach@example.com` | your `DEMO_PASSWORD` |
   | Member (adult) | `priya@example.com` | none, code only |
   | Member (parent of two kids) | `parent@example.com` | none, code only |

Free plan limits: the service sleeps after 15 minutes without visits (open it a minute before the demo), and the free database expires after 30 days. The demo data is loaded once, on the first start. Never put real member data in a demo deployment: anyone with the URL can log in as a demo member.

## Deploy on Render

`render.production.yaml` is the Render Blueprint for the real studio. It creates one web service and a PostgreSQL database in Singapore. The web service runs the API and also serves the built website and app, so everything is on one domain and the app's relative `/api` calls and login cookies work without a proxy.

1. Generate the QR signing key on your computer and keep it safe. If it changes, every QR code already issued stops working:

   ```bash
   node -e "const {privateKey}=require('crypto').generateKeyPairSync('ed25519');console.log(Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))"
   ```

2. Render dashboard: **New**, then **Blueprint**, then pick this repository and branch, and set **Blueprint Path** to `render.production.yaml`. When asked, paste `QR_PRIVATE_KEY` and `RESEND_API_KEY`. `APP_SECRET` is generated for you. Set `MAIL_FROM` to an address on a domain verified in Resend.
3. Every deploy builds the website and API, runs `prisma migrate deploy` (pre-deploy step), then starts the server. Check `https://<service>.onrender.com/api/health` for `{"ok":true,"db":"up"}`.
4. Once only: load the plans and create the owner from the service's **Shell** tab:

   ```bash
   npm run db:seed -w @unifit/api
   ```

   ```bash
   npm run owner:create -w @unifit/api -- --name "Owner Name" --email owner@example.com --phone 9876543210
   ```

5. Add your domain under the service's **Settings**, then **Custom Domains**.

Plans in the Blueprint: the web service is **Starter** because the free plan has no disk and no pre-deploy step, and free instances sleep, which stops the 5-minute jobs (reminders, no-shows, expiry notices). Payment screenshots are kept on the 1 GB disk mounted at `.data`. The database is **basic-256mb**; change the plans in `render.production.yaml` if you need to.

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
