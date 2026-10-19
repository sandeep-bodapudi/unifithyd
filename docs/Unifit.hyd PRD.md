# Unifit.hyd: Product Requirements Document

Version 1.0 | Product: Unifit.hyd fitness PWA | Tagline: Train. Transform. Thrive.

## 1. Overview

Unifit.hyd is a fitness studio in Hyderabad running online and offline classes. This product is a Progressive Web App (PWA) plus an admin dashboard that lets clients register and book daily classes, lets coaches publish and run classes, and lets the admin manage members, payments and communication. Attendance is captured by QR scanning. Payments are collected through the studio's own UPI QR code and UPI ID, and the admin confirms them manually.

A working prototype (single HTML file, data stored in the browser) already demonstrates the flows below. This PRD defines what the production version must do.

## 2. Goals and Non-Goals

**Goals**

- Replace manual WhatsApp and paper tracking with one app for bookings, attendance and payments.
- Let clients register for daily classes in under 30 seconds and receive email confirmation.
- Give coaches a simple way to add classes (timing, mode, location or link, capacity).
- Give the admin full control and a clear view of who attends and who has paid.
- Let the admin change the payment UPI ID and QR code at any time without a developer.
- Be installable on phones as a PWA and follow the Unifit brand.

**Non-goals (v1)**

- Video hosting or recorded workout content (classes are timings and details only).
- Automatic payment gateway or auto-reconciliation of UPI payments.
- Native iOS or Android store apps.

## 3. Users and Roles

- **Client (member):** registers, books classes, views own fitness data, shows QR at class, pays membership.
- **Coach:** creates and manages classes, sees rosters, scans attendance, emails registrants.
- **Admin:** everything a coach can do, plus members, payments, settings, emails, reports and role management.

### Permissions matrix

| Capability | Client | Coach | Admin |
| --- | --- | --- | --- |
| Register / log in | Yes | Yes | Yes |
| View and book classes | Yes | Yes | Yes |
| View own fitness data and QR | Yes | No | Yes (any member) |
| Add, edit, delete classes | No | Yes | Yes |
| View class roster | No | Own classes | All |
| Scan or mark attendance | No | Yes | Yes |
| Manage members | No | No | Yes |
| Record payments | No | No | Yes |
| Edit payment QR and UPI ID | No | No | Yes |
| View and send emails | No | Class emails | All |
| Manage coaches and settings | No | No | Yes |

## 4. Brand and Theme

The look follows the logo.

- **Navy #12335F:** headers, primary text, buttons.
- **Green #4AA82A:** primary action, success, the 'fit' accent.
- **Blue #2A6FC4:** online class badge, links.
- **Red-orange #E0452C:** due and warning states.
- **Yellow #F5C518:** highlights and small accents.
- Rounded cards, bold sans-serif headings, circular logo in the header, tagline 'Train • Transform • Thrive' on the login screen.
- Light and dark mode supported. Mobile-first layout, bottom tab navigation.

## 5. Functional Requirements

Priority: M = must have, S = should have, C = could have.

### 5.1 Authentication and Registration

- FR-1 (M): Client registers with name, email and phone. The system assigns a unique member ID (for example UF001).
- FR-2 (M): Client logs in with email. A one-time code or magic link by email is used in production, replacing the prototype's email-only login.
- FR-3 (M): Coach and admin log in with individual accounts and passwords or PINs. Hard-coded demo PINs must be removed.
- FR-4 (M): Welcome email is sent on registration.
- FR-5 (S): Admin can disable or delete a member.

### 5.2 Classes

- FR-6 (M): A class has title, date, start time, mode (Online or Offline), location or meeting link, capacity, coach and optional notes.
- FR-7 (M): Coach or admin can add, edit and delete classes. Deleting a class with registrations notifies registrants by email.
- FR-8 (M): Clients see upcoming classes, with today's classes first, remaining spots, and a mode badge.
- FR-9 (M): Online class links are shown only to registered clients. Offline classes show the location.
- FR-10 (S): Recurring classes (daily or weekly templates) so coaches do not re-enter each day.
- FR-11 (C): Waitlist when a class is full.

### 5.3 Daily Registration and Tracking

- FR-12 (M): Client registers for and cancels a class. Registration closes at capacity.
- FR-13 (M): The system tracks, per class, who registered and who actually attended.
- FR-14 (M): Confirmation email on registration, cancellation email on cancel.
- FR-15 (M): Reminder email to registrants, sent manually by coach or admin in v1, and automatically (for example 2 hours before) in v1.1.
- FR-16 (S): Cancellation cut-off time configurable by admin.

### 5.4 Attendance Scanner

- FR-17 (M): Each member has a personal QR code containing their member ID, shown in the app.
- FR-18 (M): Coach or admin selects today's class, then scans member QR codes with the phone camera.
- FR-19 (M): Manual member ID entry as a fallback when the camera is unavailable.
- FR-20 (M): Duplicate scans for the same class are ignored with a clear message.
- FR-21 (M): The scanner warns when the member's payment is due, but does not block entry unless the admin enables that setting.
- FR-22 (S): Walk-in handling: marking a member present who did not pre-register.

### 5.5 Client Fitness Data

- FR-23 (M): Client dashboard shows classes attended, classes this month, current day streak and number of upcoming registrations.
- FR-24 (M): Client can log weight and see a trend of recent entries.
- FR-25 (C): Additional measurements (waist, chest) and personal goals.

### 5.6 Payments (Manual, UPI QR)

The studio does not use a payment gateway. Clients pay through UPI using a QR code and UPI ID owned by the studio. The admin verifies and records each payment by hand.

**Admin payment settings (Settings page, admin only)**

- FR-26 (M): Admin can upload or replace the UPI QR code image. Accepted types: PNG, JPG, WebP. Images are resized in the browser and stored in the database or file storage.
- FR-27 (M): Admin can enter and edit the UPI ID (for example studioname@bank) and the payee name.
- FR-28 (M): Admin can remove the QR code. Changes take effect immediately for every client, with no app release.
- FR-29 (S): UPI ID format check (text, then @, then handle) with a warning if invalid.
- FR-30 (S): Settings changes are written to an audit log with admin name and time.

**Client payment screen**

- FR-31 (M): A Pay tab shows the current QR code and UPI ID, a Copy UPI ID button, and an Open UPI app button using a upi://pay link built from the UPI ID and payee name.
- FR-32 (M): If no payment details are set, the screen shows a friendly 'details coming soon, please ask the studio' message.
- FR-33 (M): The client sees their membership status (Paid until a date, or Due).
- FR-34 (S): Client can submit 'I have paid' with the UPI reference number (UTR) and an optional screenshot. This creates a Pending payment for the admin to verify. This is not in the prototype.

**Admin payment recording**

- FR-35 (M): Admin records a payment by choosing the member, amount, duration (1, 3, 6 or 12 months), date and payment note or UTR. Membership valid-until date is extended from the later of today or the current valid-until date.
- FR-36 (M): Admin can mark a member as Due (reverse a payment) with a reason.
- FR-37 (M): A confirmation email is sent to the client when a payment is recorded.
- FR-38 (M): Payment history per member and a total collected figure on the dashboard.
- FR-39 (S): Export payments to CSV for accounting.
- FR-40 (S): Reminder email to members whose membership expires in 3 days or is overdue.

### 5.7 Admin Dashboard

- FR-41 (M): Cards for total members, paid members, due members, classes today, attended today and money collected.
- FR-42 (M): Today's schedule with registered and present counts per class.
- FR-43 (M): Member list with search, payment status and attendance count.
- FR-44 (S): Attendance and revenue reports by date range, exportable to CSV.
- FR-45 (S): Manage coach accounts.

### 5.8 Email Notifications

- FR-46 (M): Emails sent for welcome, class registration, class cancellation, class reminder and payment received.
- FR-47 (M): All sent emails are logged and viewable by the admin, with status (sent or failed).
- FR-48 (M): Emails use the Unifit brand colors and logo.
- FR-49 (S): Editable email templates in admin settings.

### 5.9 Online and Offline Classes

- FR-50 (M): Mode is a required field on every class and is visible as a badge everywhere the class appears.
- FR-51 (M): Online classes need a valid meeting URL. Offline classes need a location name (optional map link).
- FR-52 (S): Reports can be filtered by mode.

## 6. PWA Requirements

- PR-1 (M): Web app manifest with name, short name, theme color #12335F, standalone display mode, and icons (192 and 512 px, including a maskable icon) made from the logo.
- PR-2 (M): Service worker that caches the app shell so the app opens offline and loads quickly. Class data shows last-known state with an 'offline' notice.
- PR-3 (M): Served over HTTPS (required for install prompt and camera access).
- PR-4 (M): Custom 'Install app' prompt on Android and Add to Home Screen guidance on iOS.
- PR-5 (S): Push notifications for class reminders (Android and iOS 16.4+ installed PWAs).
- PR-6 (M): Camera permission request handled gracefully, with manual entry fallback.

## 7. Data Model

- **Member:** id, member code, name, email, phone, status, joined date, paid-until date.
- **Staff:** id, name, email, role (coach or admin), password hash.
- **Class:** id, title, date, start time, duration, mode, location or link, capacity, coach id, notes, status.
- **Registration:** id, class id, member id, created at, cancelled at.
- **Attendance:** id, class id, member id, scanned at, scanned by, method (QR or manual).
- **Payment:** id, member id, amount, months, paid on, valid-until after payment, UTR or note, status (pending, verified, reversed), recorded by.
- **Settings:** UPI ID, payee name, QR image reference, studio name, cancellation cut-off, block-if-due flag.
- **WeightLog:** id, member id, date, weight.
- **EmailLog:** id, to, subject, body, type, status, sent at.
- **AuditLog:** id, actor, action, details, time.

## 8. Key User Flows

1. **New client:** open app, register, receive welcome email, browse today's classes, register, receive confirmation, open My QR at the studio.
2. **Coach:** log in, add class with mode and location or link, check roster, open Scanner, scan members, email registrants.
3. **Payment:** client opens Pay tab, scans the studio QR or copies the UPI ID, pays in their UPI app. Admin sees the payment in the bank or UPI app, opens Payments, records amount and duration. Client status changes to Paid and a confirmation email is sent.
4. **Admin changes UPI details:** open Settings, enter the new UPI ID, upload the new QR, save. Clients see the new details immediately.

## 9. Screens

- **Public:** Login and Register.
- **Client:** Classes, My Fitness, My QR, Pay.
- **Coach:** Classes (manage), Scanner.
- **Admin:** Dashboard, Classes, Members, Payments, Scanner, Emails, Settings (payment details, studio info, coach accounts).

## 10. Non-Functional Requirements

- **Performance:** first load under 3 seconds on 4G; app shell loads offline.
- **Security:** HTTPS only; hashed passwords; role-based access enforced on the server, not only in the UI; rate limiting on login; QR payloads contain only the member code.
- **Privacy:** store only needed personal data; admin-only access to phone numbers and payment records; member data deletion on request.
- **Reliability:** daily database backups; email failures retried.
- **Accessibility:** readable contrast, touch targets of at least 44 px, labelled form fields.
- **Compatibility:** latest Chrome and Safari on Android and iOS, plus desktop browsers.
- **Data accuracy:** a class cannot exceed capacity even with simultaneous bookings.

## 11. Recommended Tech Stack

- **Frontend:** React or plain JavaScript PWA with a service worker and manifest (the prototype can be reused as the UI base).
- **Backend and database:** Supabase (Postgres, Auth, Storage for the QR image, row-level security) or Firebase.
- **Email:** Resend, Brevo or SendGrid, called from a serverless function.
- **QR:** qrcode-generator for member QR, jsQR for scanning.
- **Hosting:** Vercel or Netlify with HTTPS and a custom domain.
- **Scheduled jobs:** Supabase scheduled functions for reminders and expiry notices.

## 12. Acceptance Criteria (highlights)

- A client can register and book a class, and receives an email within 1 minute.
- A class with capacity 20 rejects the 21st booking.
- Online links are not visible to unregistered clients.
- Scanning a valid member QR marks them present once; a second scan shows 'already marked'.
- After the admin saves a new UPI ID and QR, a client opening the Pay tab sees the new values without reinstalling the app.
- Recording a 3-month payment sets valid-until three months ahead and sends a payment email.
- A coach cannot open Members, Payments or Settings.
- The app can be installed to the home screen and opens offline.

## 13. Delivery Plan

- **Phase 1 (MVP, 3 to 4 weeks):** accounts and roles, classes, registration, QR attendance, manual payments with admin-managed UPI QR and ID, email confirmations, admin dashboard, PWA install and offline shell.
- **Phase 2 (2 to 3 weeks):** UTR submission by clients, automatic reminders and expiry emails, recurring classes, CSV exports, reports, audit log.
- **Phase 3:** push notifications, waitlist, extra measurements and goals, editable email templates.

## 14. Risks and Open Questions

- **Manual payment checking** can be slow or error-prone. Mitigation: UTR submission and a pending-payments list (FR-34).
- **QR image of poor quality** may not scan. Mitigation: show the UPI ID and Open UPI app button beside the QR.
- **iOS PWA limits** (camera and push behaviour). Mitigation: test early; keep manual entry fallback.
- **Email deliverability.** Mitigation: authenticated sending domain (SPF and DKIM).
- **Open questions:** membership plans and prices; class cancellation cut-off; whether entry should be blocked for unpaid members; whether coaches see payment status; which email address and domain to send from; data retention period.
