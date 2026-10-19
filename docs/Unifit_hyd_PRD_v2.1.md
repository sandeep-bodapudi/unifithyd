# Unifit.hyd: Product Requirements Document v2.1

Production-review edition | Fitness PWA, admin dashboard and public website | Tagline: Train. Transform. Thrive.

## 1. Verdict on v1.0: is it production-ready?

**Not yet.** v1.0 is a strong, well-scoped draft. The flows, roles and permissions matrix are clear, and the manual UPI approach fits how the studio works. But it has gaps that would cause real problems after launch (fraud, wrong billing, legal exposure, missed timelines). This version fixes them. Items marked **Blocker** must be settled before development starts.

| # | Finding in v1.0 | Risk | Severity | Fix in v2.0 |
| --- | --- | --- | --- | --- |
| 1 | Member QR holds only a guessable member ID (UF001). A screenshot can be shared, and anyone can type an ID. | Buddy check-ins, fake attendance | **Blocker** | Signed, opaque QR token that expires (section 9). Manual entry is staff-only and audit-logged. |
| 2 | Audit log for payment settings is only "Should". | If an admin account is hacked, the UPI ID is swapped and every member pays a stranger. | **Blocker** | Audit log is Must. Changing UPI ID or QR needs re-authentication, decodes the QR to check it matches the UPI ID, and emails all admins. |
| 3 | No membership plans or prices. Data model has only "paid-until". | Cannot build billing, pricing page or reports. | **Blocker** | Plans model added (section 8). Needs your answers in section 2. |
| 4 | No legal pages or consent: terms, privacy policy, health waiver, refund policy. | Legal exposure, injury liability, India DPDP Act compliance. | **Blocker** | Consent and waiver captured at registration and stored with a timestamp (section 14). |
| 5 | Client login is email-only. | Many members in Hyderabad live on WhatsApp and phone numbers. Email codes land in spam. | High | Offer phone OTP or WhatsApp as an option (question 4). |
| 6 | No public website. The brief says "website" but the PRD covers only the app and dashboard. | No way for new people to find, trust or join the studio. | High | Public site added to scope (section 5). |
| 7 | MVP of 3 to 4 weeks. | Too short for this scope with testing. Quality will be cut at the end. | High | Realistic plan of 8 to 10 weeks for one developer, with cut options (section 16). |
| 8 | Scanner needs live internet. | Studio Wi-Fi or mobile data fails, so check-in stops. | High | Scanner queues scans offline and syncs later. |
| 9 | Colour contrast: white text on brand green (#4AA82A) is about 3:1, and red-orange (#E0452C) on white is about 4.1:1. Both fail the 4.5:1 target for normal text. | Hard to read, fails the PRD's own accessibility goal. | Medium | Dark-first palette with accessible tokens (section 4). |
| 10 | Stack suggests Supabase or Firebase. | Not wrong, but it is not the stack you know best (React, Node, Express, Prisma, MySQL). | Medium | Decision needed (question 8). Recommendation in section 12. |
| 11 | Payment screenshot uploads, UTR duplicates and refunds are not handled. | Fake or reused proofs, storage abuse, disputes. | Medium | Hardened payment rules (section 7). |
| 12 | No monitoring, staging environment, backup restore test, or go-live checklist. | Silent failures, data loss. | Medium | Added in sections 13 and 16. |
| 13 | Automatic reminders pushed to "v1.1". | Reminders are the biggest no-show reducer and are cheap to build. | Medium | Automatic reminders move into the MVP. |
| 14 | FR-15 wording is ambiguous ("manual in v1 and automatic in v1.1"). | Different readers will build different things. | Low | Clarified in section 10. |

## 1A. Your answers and what changed (v2.1)

Your answers settle the plans, the stack and billing. They also raise four points that need attention: GST, kids' data, message setup and class codes. The plan is now 8 to 10 weeks for one developer.

### Decided

| Topic | Decision |
| --- | --- |
| Plans and prices | Kids Training ₹3,000 a month (3 classes a week, 12 a month), Adult Training ₹15,000 a month, Group Classes ₹3,000 a month (section 8) |
| Kids | Allowed, through a parent or guardian account (section 7.9) |
| Login | Email, with a one-time code sent by WhatsApp or SMS. Coaches log in with their own email |
| Coaches | Admin adds each coach by email. Coach photos are added later |
| Domain | unifithyd.com, bought in the studio owner's name |
| Stack | React, Node.js, Express, Prisma, MySQL |
| Billing | Numbered receipts, no GST for now (section 7.10) |

### Policies I set (you asked me to decide; the owner should approve)

| Rule | Proposed policy |
| --- | --- |
| Cancel a class | Free until 2 hours before. A later cancellation or no-show uses up the class |
| Refund | Full refund if cancelled within 3 days of payment and no class attended. After that no refund, except at the owner's discretion for illness or hardship |
| Missed classes | No carry-over to next month. If the studio cancels a class, the member gets a make-up class |
| Class limits | Kids Training: 3 a week and 12 a month, enforced by the app. A week runs Monday to Sunday |
| Grace period | 3 days after expiry, then the member is Due. Entry shows a warning and is not blocked |
| Freeze | One freeze per plan, up to 14 days, set by the admin |

### Four points that need attention

1. **GST can apply sooner than you think.** GST registration is required once yearly turnover from services passes ₹20 lakh, and gym and fitness services are reported at 5% GST without input credit since 22 September 2025. At ₹15,000 a month, 12 adult members for a full year is about ₹21.6 lakh, before kids and group fees. Ask your accountant now. The app prints receipts without GST and keeps GST fields ready to switch on.
2. **Kids' data has stricter rules.** The DPDP Rules 2025 require verifiable parental consent for children's data and restrict tracking or behavioural monitoring of children, with some exemptions. The main duties are reported to apply from 14 May 2027, so the app is built for them from day one. A lawyer should confirm what applies to a studio.
3. **WhatsApp and SMS codes need setup time.** WhatsApp needs a verified business number and an approved code template. SMS in India needs DLT registration of the studio. Both can take days to weeks and charge per message. I added limits per phone number and per day so nobody can run up your bill. Email codes stay as a fallback.
4. **"Coach generates the code for classes" is unclear.** See open question 3 below.

### Still open

1. Adult Training: same 3 a week and 12 a month? Is it personal or small-batch, and how many people per class?
2. Group Classes: how many per week, and who attends (kids, adults, both)?
3. What does "coach generates the code" mean? (a) The coach shows a short code that changes every minute and members type it to mark attendance. (b) The coach creates an invite code for new members. (c) The coach adds a joining code or link to a class. My recommendation is (a), as a backup to QR scanning.
4. Is the month counted from the payment date or the calendar month? *Default: from the payment date.*
5. Any discount for 3, 6 or 12 months, and any free trial class?
6. Which message provider and monthly budget? Examples: MSG91, Gupshup, Twilio.
7. Is the public website in scope, and is the dark logo the main logo? (earlier questions 17 and 18)

Sources, taken from search results and not checked against official notifications: [GST on sports and fitness services](https://www.taxaj.com/learn/gst-sports-fitness-coaching-services/), [DPDP Rules 2025 timeline](https://anantamias.com/current-affairs/dpdp-rules-2025-notified/?pdf=1), [DPDP children's data rules](https://dsklegal.com/?p=26455).

## 2. Questions I need answered

Each question has a **default assumption**. If you do not answer, I will plan with the default so work is not blocked.

**About the business**

1. **Membership plans and prices.** What plans exist (monthly, quarterly, 6 and 12 months)? Is it unlimited classes, or a fixed number per month? Any drop-in or trial class? *Default: time-based plans of 1, 3, 6 and 12 months with unlimited classes, plus one free trial class.*
2. **Online and offline pricing.** Is one membership valid for both modes? *Default: yes, one plan covers both.*
3. **Minors.** Do under-18s join? India's DPDP Act needs verifiable parental consent for children's data. *Default: members must be 18 or older. Under-18 joins through a parent account.*

**About login and messages**

4. **Client login.** Email code, phone OTP, or WhatsApp? Phone OTP by SMS has a per-message cost and needs DLT registration in India. *Default: email code at launch, phone number collected and verified later.*
5. **WhatsApp reminders.** Should class reminders go on WhatsApp too? It needs a WhatsApp Business API provider and approved message templates, and has per-message costs. *Default: email in the MVP, WhatsApp click-to-chat links only.*
6. **Sender email and domain.** Which domain do you own (for example unifithyd.com)? Emails need SPF, DKIM and DMARC set up on it. *Default: buy a domain and use a no-reply and a support address.*

**About build and operations**

7. **Who builds and who maintains?** You alone, or a team? How many classes a day and how many members do you expect in year one? *Default: one developer, up to 500 members, up to 8 classes per day.*
8. **Tech stack.** Supabase (fastest, managed), or React with Node, Express, Prisma and MySQL or PostgreSQL (what you already know)? *Default: the second, see section 12.*
9. **Budget and hosting.** Is there a monthly budget cap? Are you happy to use managed services for hosting, database and email? *Default: low-cost managed services.*

**About rules**

10. **Cancellation and no-show policy.** Cut-off time before class? Any penalty for late cancellation? *Default: free cancellation up to 2 hours before.*
11. **Unpaid members.** Warn only, or block check-in? *Default: warn only, admin can switch to blocking.*
12. **Grace period.** How many days after expiry before a member counts as Due? *Default: 3 days.*
13. **Refunds and membership freezes.** Are they allowed? *Default: no refunds, one freeze request per plan handled by admin.*
14. **GST and receipts.** Does the studio charge GST and need numbered invoices? Ask your accountant. *Default: simple numbered receipts, GST fields ready but off.*
15. **Coaches and payments.** Can coaches see whether a member is Paid or Due? *Default: yes, status only, never amounts.*
16. **Data retention.** How long to keep inactive member data? *Default: 2 years after last activity, then delete or anonymise.*

**About brand**

17. Do you want the **dark logo** as the main logo in the app and the light one only for print and white backgrounds? *Default: yes.*
18. Do you have real photos of classes and coaches for the public website? *Default: placeholders until you supply photos.*

## 3. Product overview

Unifit.hyd is a fitness studio in Hyderabad running online and offline classes. The product has three parts:

1. **Public website:** shows the studio, class schedule, plans and contact details, and lets new people join.
2. **Member PWA:** members register, book classes, show their QR at the studio, pay and track progress.
3. **Staff and admin dashboard:** coaches run classes and scan attendance, and the admin manages members, payments, settings and reports.

Payments use the studio's own UPI QR and UPI ID. The admin confirms each payment by hand. There is no payment gateway in v1.

### Goals

- Replace WhatsApp and paper tracking with one system for bookings, attendance and payments.
- Let a new member register and book a class in under 30 seconds.
- Let coaches add classes quickly and see who is coming.
- Give the admin a reliable view of who attended and who has paid.
- Let the admin change the UPI ID and QR safely without a developer.
- Be installable on phones and consistent with the Unifit brand.

### Non-goals (v1)

Video hosting or recorded workouts, payment gateway or auto-reconciliation, native store apps, and in-app chat.

## 4. Brand and design system (dark-first)

The chosen logo is the dark version: a bold flat "U" with a rising right stem, white on deep navy, with a green accent. The wordmark is bold, slanted and lowercase: uni**fit**.hyd.

| Token | Value | Use |
| --- | --- | --- |
| Background (dark) | #0B1F3F | App and website background |
| Surface | #12335F | Cards, headers |
| Text primary | #FFFFFF | Body and headings on dark |
| Text secondary | #9FB4D3 | Captions and hints |
| Green (brand) | #4AA82A | Logo accent, large text, icons, success on dark |
| Green (text and buttons on light) | #2E7D1A | Normal-size text and buttons with white text on light backgrounds (5:1 contrast) |
| Blue | #2A6FC4 | Online badge, links on light |
| Link on dark | #6FA8F0 | Links on dark backgrounds |
| Warning | #E0452C on dark, #C23118 on light | Due and error states |
| Yellow | #F5C518 | Small highlights only, never text on light |

Rules: mobile-first, rounded cards, bottom tab navigation, light mode available (follows the phone setting), 44 px touch targets, never use colour alone to show a status (add an icon or label). Typeface: Poppins for headings, system sans-serif for body text to keep loading fast.

## 5. Public website (new)

**Pages:** Home (hero, today's classes, Join button), About and coaches, Class schedule (public, read-only, no online links), Plans and pricing, Gallery, FAQ, Contact (map, phone, WhatsApp button), Terms, Privacy, Refund policy.

**Requirements**

- WEB-1 (M): Fast, mobile-first, HTTPS, with a clear Join and Login button on every page.
- WEB-2 (M): Plans and pricing pulled from admin settings so it never goes stale.
- WEB-3 (M): Google Business Profile, local SEO (title, description, structured data for a local business), and a sitemap.
- WEB-4 (S): Free trial class sign-up form with spam protection.
- WEB-5 (S): Privacy-friendly analytics.
- WEB-6 (C): Blog or transformation stories.

## 6. Users, roles and permissions

Roles: **Client**, **Coach**, **Admin** (and one **Owner** admin who cannot be removed). All role checks run on the server.

| Capability | Client | Coach | Admin |
| --- | --- | --- | --- |
| Register, log in, edit own profile | Yes | Yes | Yes |
| View and book classes | Yes | Yes | Yes |
| Own fitness data and QR | Yes | No | Any member |
| Add, edit, delete classes | No | Own classes | All |
| View class roster | No | Own classes | All |
| Scan or mark attendance | No | Own classes | All |
| See member payment status (Paid or Due) | Own | Yes (status only) | Yes |
| Manage members and payments | No | No | Yes |
| Edit UPI ID, QR and settings | No | No | Yes, with re-authentication |
| View audit log and email log | No | No | Yes |
| Manage coaches and admins | No | No | Owner only |

Admin and coach accounts must use two-step login (password plus email code) before launch.

## 7. Functional requirements

Priority: M = must, S = should, C = could.

### 7.1 Accounts

- FR-1 (M): Registration with name, email, phone (+91 format check) and date of birth (members under 18 are registered by a parent or guardian, see 7.9). A unique member code is created by the database, not by the app, so two people never get the same one.
- FR-2 (M): Client login by one-time code sent to the registered email and to the phone by WhatsApp or SMS (member's choice). Codes expire in 10 minutes, are single-use, and are limited to 5 tries and a few sends per hour.
- FR-3 (M): Staff login with individual accounts, hashed passwords (Argon2 or bcrypt) and a second step. No demo PINs anywhere.
- FR-4 (M): At registration the member accepts Terms, Privacy Policy and a health waiver. The versions accepted and the time are stored.
- FR-5 (M): Duplicate email or phone is rejected with a clear message.
- FR-6 (M): Member can edit profile, export their data and request deletion.
- FR-7 (S): Admin can disable or delete a member. Deletion anonymises records that must be kept for accounting.

### 7.2 Classes

- FR-8 (M): Class fields: title, date and start time (stored in UTC, shown in IST), duration, mode, location or link, capacity, coach, notes, status.
- FR-9 (M): Coach or admin adds, edits and deletes classes. Editing time, mode or location, or deleting, emails all registrants.
- FR-10 (M): Clients see upcoming classes with today first, spots left and a mode badge.
- FR-11 (M): Online links are visible only to registered members and only from 30 minutes before start. Offline classes show location and map link.
- FR-12 (S): Recurring classes (daily or weekly templates, with edit-this-one and edit-all).
- FR-13 (S): Waitlist with automatic promotion and notification when a spot opens.

### 7.3 Booking

- FR-14 (M): Register and cancel. A database rule makes it impossible to book past capacity or to book the same class twice, even with simultaneous requests.
- FR-15 (M): Only members with a valid membership (or a trial) can book. Behaviour for Due members is set by the admin.
- FR-16 (M): Cancellation cut-off configurable by admin (default 2 hours).
- FR-17 (M): Confirmation and cancellation emails.
- FR-18 (M): **Automatic reminder** about 2 hours before class. Coaches can also send a manual message to registrants.

### 7.4 Attendance scanner

- FR-19 (M): Coach selects a class and scans member QR codes.
- FR-20 (M): Manual entry fallback for staff only. Every manual mark records who did it and why.
- FR-21 (M): Duplicate scans are ignored with a clear message.
- FR-22 (M): Scanner shows member name, photo placeholder and Paid or Due. It blocks entry only if the admin enabled that setting.
- FR-23 (M): **Offline mode:** scans are saved on the device and synced when internet returns. A banner shows pending scans.
- FR-24 (S): Walk-in marking for members who did not pre-register, within capacity rules.

### 7.5 Member fitness data

- FR-25 (M): Dashboard with classes attended, classes this month, streak and upcoming bookings. Streak uses IST days.
- FR-26 (M): Log weight with a simple trend. Clearly optional.
- FR-27 (C): More measurements and goals.

### 7.6 Payments (manual UPI)

**Admin settings**

- FR-28 (M): Admin uploads or replaces the UPI QR (PNG, JPG, WebP, max 2 MB). The server re-encodes the image, strips metadata and rejects other types.
- FR-29 (M): Admin sets UPI ID and payee name. Format is validated.
- FR-30 (M): On save, the app decodes the QR and checks that it contains the same UPI ID. A mismatch is blocked.
- FR-31 (M): Changing UPI details needs password plus email code, writes to the audit log, and emails every admin. Old values are kept in the log.
- FR-32 (M): Changes apply to all clients immediately.

**Client payment screen**

- FR-33 (M): Pay tab shows the plan options, QR, UPI ID, Copy button and an Open UPI app button (upi://pay link with the exact amount of the chosen plan).
- FR-34 (M): If details are missing, a friendly message appears.
- FR-35 (M): Membership status shows Paid until a date, Due, or Pending verification.
- FR-36 (M): Client submits "I have paid" with the 12-digit UTR and optional screenshot (max 2 MB, images only). The same UTR cannot be used twice. This creates a Pending payment.

**Admin recording**

- FR-37 (M): Admin verifies a pending payment, or records one directly: member, plan, amount, date, UTR. Valid-until extends from the later of today or the current end date.
- FR-38 (M): Reversal needs a reason and is logged. Nothing is hard-deleted.
- FR-39 (M): Payment email and numbered receipt sent to the member.
- FR-40 (M): Payment history per member and totals on the dashboard. Amounts are stored as whole paise to avoid rounding errors.
- FR-41 (S): CSV export for accounting.
- FR-42 (M): Automatic expiry reminders: 3 days before and on the day after expiry.

### 7.7 Admin dashboard and reports

- FR-43 (M): Cards: total members, active, due, classes today, attended today, collected this month.
- FR-44 (M): Today's schedule with registered and present counts.
- FR-45 (M): Member list with search, filters and payment status.
- FR-46 (S): Attendance and revenue reports by date and mode, exportable.
- FR-47 (M): Coach and admin account management.

### 7.8 Notifications

- FR-48 (M): Emails: welcome, login code, booking, cancellation, class change, reminder, payment received, expiry notice.
- FR-49 (M): Email log with status. Failed emails retry up to 3 times. Bounced addresses are flagged.
- FR-50 (M): Branded email design with the dark logo on a light email body.
- FR-51 (S): Editable templates (text is escaped to prevent injection).
- FR-52 (C): WhatsApp reminders (question 5).

### 7.9 Kids and guardians (new)

- KID-1 (M): Members under 18 are registered by a parent or guardian. The parent's email and phone receive all codes and messages. One parent account can hold several children.
- KID-2 (M): The parent accepts the Terms, Privacy Policy and health waiver for each child. The consent, its version and the time are stored separately from the child's profile.
- KID-3 (M): Children have no login of their own. The parent's phone shows the child's QR.
- KID-4 (M): A child's profile keeps only attendance and class history. No weight log, no measurements, no behavioural tracking and no ads.
- KID-5 (M): Each class is marked Kids, Adults or Mixed. Kids can book only Kids or Mixed classes, and adults only Adults or Mixed.
- KID-6 (M): Coaches see a child's name and the parent's phone only for their own classes.
- KID-7 (M): Photos of children on the website or social media need separate written parental consent. The default is off.
- KID-8 (S): Optional emergency contact and health note, visible only to the admin and the class coach. Collect it only if the studio needs it.
- KID-9 (M): When a child turns 18, the profile moves to an adult account and the member accepts the terms again.
- Studio policy, not software: police verification for coaches who train children.

### 7.10 Receipts and billing (new)

- BILL-1 (M): Every verified payment creates a numbered receipt, for example UF-2026-0001, showing studio name, member, plan, period, amount, date and UTR.
- BILL-2 (M): The document is titled "Receipt" with no tax lines while the studio is not GST-registered.
- BILL-3 (M): GST number, tax rate and tax lines exist in settings but are off. Turning them on changes future receipts only, never old ones.
- BILL-4 (M): Receipts are emailed as PDF and can be downloaded again by the member. The admin can reissue one.
- BILL-5 (S): Monthly payment summary export for the accountant.
- BILL-6 (M): Receipt numbers never repeat and are never deleted. A reversed payment gets a credit note instead.

## 8. Membership and pricing model (new)

- A **Plan** has a name, duration in months, price, and a rule (unlimited, or N classes).
- A **Membership** links a member to a plan with start and end dates and a status: trial, active, grace, expired, frozen.
- A member is **Due** after expiry plus the grace period.
- Renewing early extends from the current end date, so no days are lost.
- A freeze pauses the end date for the days frozen (admin only).
- Prices shown on the website and the Pay tab come from the same plan records.

Plans from the owner. Prices are stored as paise (300000 and 1500000).

| Plan | Price per month | Classes | Who |
| --- | --- | --- | --- |
| Kids Training | ₹3,000 | 3 a week, 12 a month | Kids |
| Adult Training | ₹15,000 | Same class timings, class count to confirm | Adults |
| Group Classes | ₹3,000 | To confirm | To confirm |

The app checks the weekly and monthly limit when a member books, and shows the classes left.

## 9. Attendance QR design

The QR does not contain the member code. It contains a short-lived signed token.

- The server issues a token tied to the member that is valid for a few minutes, and the app refreshes it while open.
- The scanner sends the token to the server, which checks signature, expiry and the member's status.
- Screenshots stop working after expiry, so they cannot be shared.
- If the member is offline, the app shows the last token for up to 24 hours (a trade-off for weak signal). The scanner accepts it, and the server re-checks it when synced.
- Member codes (UF001) are display labels only and are never accepted as proof on their own, except through the logged manual entry.

## 10. PWA requirements

- PR-1 (M): Manifest with name, short name, dark theme colour #0B1F3F, standalone mode, icons 192 and 512 px, plus a maskable icon with safe padding, all from the new logo.
- PR-2 (M): Service worker caches the app shell. Class lists show last known data with an offline notice. Booking and payment actions are disabled offline with a clear message.
- PR-3 (M): An update prompt appears when a new version is ready, so nobody is stuck on an old version.
- PR-4 (M): HTTPS only (needed for install and camera).
- PR-5 (M): Install prompt on Android and Add to Home Screen steps on iOS.
- PR-6 (M): Camera permission is handled gracefully with the staff manual fallback.
- PR-7 (S): Push notifications (Android, and iOS 16.4+ for installed apps).

## 11. Data model (revised)

All tables have created and updated times. Money is in paise. Times are UTC.

- **Member:** id, member code (database sequence), name, email, phone, date of birth, status, joined date, consent record id.
- **Staff:** id, name, email, role, password hash, two-step settings, disabled flag.
- **Plan:** id, name, months, price, class limit, active.
- **Membership:** id, member id, plan id, start, end, status, frozen days.
- **Class:** id, series id (optional), title, start (UTC), duration, mode, location or link, capacity, coach id, notes, status.
- **Registration:** id, class id, member id, status, created, cancelled. **Unique on class and member.**
- **Attendance:** id, class id, member id, scanned at, scanned by, method, client scan id. **Unique on class and member.**
- **Payment:** id, member id, membership id, amount, UTR (**unique**), proof file, status (pending, verified, rejected, reversed), recorded by, reason, receipt number.
- **Settings:** UPI ID, payee name, QR file, studio name, cancellation cut-off, grace days, block-if-due flag.
- **Consent:** id, member id, document type and version, accepted at.
- **WeightLog:** id, member id, date, weight.
- **LoginCode and Session:** hashed code, expiry, attempts; refresh sessions with revoke.
- **EmailLog:** id, to, subject, type, status, attempts, sent at (body kept only for a short period).
- **AuditLog:** id, actor, action, old and new values, IP, time. Append-only.

## 12. Architecture and stack

**Recommended (matches your skills):** React with Vite and a PWA plugin for the app and website, Node.js with Express and Prisma for the API, MySQL 8, a transactional email provider such as Resend or Brevo, object storage for images, a scheduler for reminders (cron job on the server or a managed scheduler), and hosting with HTTPS and a custom domain.

**Alternative (fastest):** Supabase (database, auth, storage, row-level security) with scheduled functions. Good if you want less server work, but you must write the access rules very carefully.

**Design rules that apply either way**

- Booking, attendance and payments run inside database transactions with unique constraints.
- Session cookies are httpOnly, secure and SameSite, with CSRF protection.
- Three environments: local, staging, production, with separate databases and keys.
- Database migrations in version control. Secrets only in environment variables.
- The scale is small (hundreds of members), so keep it a simple single service and avoid microservices.

## 13. Non-functional requirements

**Security**

- Server-side role checks on every endpoint. Rate limits on login, codes and uploads.
- Input validation on all inputs. Protection against the common web attack types (OWASP Top 10).
- Two-step login for staff. Failed-login lockouts and alerts.
- Uploaded files are scanned for type and size, renamed, and stored outside the web root.

**Privacy and legal (India)**

- Collect only what is needed. Show a clear consent notice at sign-up.
- Phone numbers and payment records are visible to admins only. Coaches see names and status.
- Support access, correction and deletion requests, and have a breach response plan.
- The Digital Personal Data Protection Act, 2023 applies. Its rules are being phased in, so ask a lawyer to confirm current duties before launch.
- Documents to write: Terms of Service, Privacy Policy, Health and Liability Waiver, Refund and Cancellation Policy.

**Reliability**

- Daily automatic backups with point-in-time recovery if available, and a **restore test before launch**.
- Email retries. Scheduled jobs are safe to run twice (no duplicate emails).

**Observability**

- Error tracking (for example Sentry), uptime monitoring with alerts, and structured logs.

**Performance**

- First load under 3 seconds on 4G on a mid-range Android phone. Images compressed and lazy-loaded.

**Accessibility**

- Contrast of 4.5:1 for normal text, 44 px touch targets, labelled fields, keyboard and screen reader support, and no colour-only status.

**Compatibility**

- Latest Chrome and Safari on Android and iOS, and desktop browsers. Test on one low-end Android phone.

## 14. Key user flows

1. **New member:** visit website, tap Join, register and accept terms and waiver, confirm the email code, browse classes, book, get confirmation, show QR at the studio.
2. **Coach:** log in, create a class, view roster, open scanner, scan, mark manual entries with a reason.
3. **Payment:** member picks a plan, pays by UPI, submits UTR. Admin sees the pending payment, checks it in the bank app, verifies. Member sees Paid and gets a receipt.
4. **UPI change:** admin opens Settings, enters new UPI ID and QR, re-authenticates, the app checks the QR matches, saves, and all admins get an email.
5. **Offline scan:** the scanner has no signal, scans are queued, and sync when the signal returns.

## 15. Acceptance criteria and test plan

- A class with capacity 20 rejects the 21st booking, including when 30 people tap at the same moment.
- The same member cannot book the same class twice.
- A screenshot of a QR older than its expiry is rejected.
- A second scan shows "already marked".
- A coach cannot open Members, Payments or Settings, and the server refuses direct calls to them.
- A UPI QR that does not match the UPI ID cannot be saved.
- A reused UTR is rejected.
- A 3-month payment extends validity by three months and sends a receipt.
- Scans made offline sync without duplicates.
- The app installs, opens offline, and shows an update prompt after a new release.
- Online links are hidden from unregistered members and before the 30-minute window.
- Lighthouse scores: PWA pass, accessibility 90 or above.
- Testing: unit tests for membership and capacity logic, API tests for permissions, end-to-end tests for the five flows, a load test of simultaneous booking, and manual testing on Android and iOS.

## 16. Delivery plan (revised)

Based on one developer. Add time if there is also design, copywriting or content work.

| Phase | Weeks | Content | Exit criteria |
| --- | --- | --- | --- |
| 0. Setup | 1 | Answers to section 2, domain and email setup, logo and PWA icons, repo, environments, CI, database schema | Staging environment live |
| 1. Core MVP | 5 to 6 | Accounts and roles, plans, classes, booking with concurrency safety, member QR and scanner with offline queue, manual UPI payments with hardened settings, automatic reminders, admin dashboard, PWA | All Must items pass tests on staging |
| 2. Public site and legal | 1 to 2 | Website pages, pricing from settings, SEO, Terms, Privacy, Waiver, Refund policy | Documents reviewed |
| 3. Hardening and launch | 1 | Backup restore test, security review, device testing, monitoring alerts, pilot with real members and staff | Go-live checklist signed off |
| 4. After launch | 2 to 3 | Recurring classes, waitlist, CSV exports and reports, editable templates, push notifications, WhatsApp | Based on feedback |

**If time is tight, cut in this order:** push notifications, waitlist, editable templates, extra measurements, reports. Do not cut: audit log, QR security, consent, backups, concurrency checks.

**Go-live checklist:** domain and HTTPS, SPF, DKIM and DMARC passing, production secrets set, backups and restore tested, staff two-step login on, test payment recorded and receipt received, legal pages published, error alerts working, owner trained, a rollback plan.

## 17. Risks

| Risk | Mitigation |
| --- | --- |
| Manual payment checking is slow or wrong | UTR submission, unique UTR rule, pending list, admin reminders |
| Admin account compromise | Two-step login, re-authentication for UPI changes, email alerts, audit log |
| Poor QR image will not scan | Show UPI ID and Open UPI app button next to it, and decode check at upload |
| iOS PWA limits (camera, push) | Test early, keep the staff manual entry |
| Email lands in spam | Authenticated domain, plain transactional content, WhatsApp as a second channel |
| Scope too big for the timeline | Phase cuts above, a fixed Must list, and change control |
| Legal gaps | Lawyer review of the four policy documents |
| One person maintains everything | Documentation, managed services, monitoring |

## 18. Decision log

| Decision | Status |
| --- | --- |
| Dark logo as main brand mark | Chosen by you |
| Dark-first design with accessible green and warning tokens | Proposed |
| Signed expiring QR tokens | Proposed |
| Automatic reminders in the MVP | Proposed |
| Public website in scope | Needs your confirmation (question 18 and section 5) |
| Tech stack | Decided: React, Node, Express, Prisma, MySQL |
| Plans, prices, cancellation, grace period, refunds, GST | Mostly answered, see section 1A |
