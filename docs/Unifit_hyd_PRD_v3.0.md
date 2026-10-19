# Unifit.hyd: Product Requirements Document v3.0

Build edition | Public website, member PWA, staff and admin dashboard | Tagline: Train. Transform. Thrive.

## 0. Document control

| Item | Value |
| --- | --- |
| Version | 3.0 (replaces v1.0 and v2.1) |
| Status | Draft for owner sign-off |
| Product owner | Studio owner (business rules, prices, legal sign-off) |
| PRD owner | Product lead (keeps this document current) |
| Single source of truth | This file. If a chat, call or WhatsApp message disagrees with it, this file wins until it is updated. |
| How to change it | Raise a change request (section 21.2). The PRD owner updates the file, bumps the version and adds a change log line. |

**How to read this document.** Sections 1 to 5 are for everyone. Sections 6 to 13 are the build specification. Sections 14 to 20 cover quality, delivery and operations. Requirement IDs (for example BKG-3) are stable: use them in tickets, commits and test cases.

**Priority:** M = must for launch, S = should (planned for launch, first to cut), C = could (after launch).

### 0.1 Glossary

| Term | Meaning |
| --- | --- |
| Account | A login. Owned by one adult (a member, a parent or a staff member). |
| Profile | A person who trains. An adult account has its own profile. A parent account can hold several child profiles. A staff account can also have a profile if the coach trains. |
| Program | A type of training: Kids Training, Adult Training, Group Classes. Every class belongs to one program. |
| Plan | What a member buys: price, cycle length, which programs it covers, and how many classes it allows. |
| Membership | One paid period of a plan for one profile, with a start and end date. |
| Cycle | One month of a membership, counted from its start date. |
| Credit | One class allowed by a limited plan in the current cycle. |
| Class | One scheduled session. Created alone or from a series. |
| Series | A repeating class template (for example Mon, Wed, Fri at 6 pm). |
| Booking | A profile's place in a class. |
| Check-in | Proof the profile attended (QR scan, class code, or staff mark). |
| UTR | The 12-digit UPI transaction reference a member sees after paying. |
| Grace | Days after a membership ends before the member counts as Due. |
| Freeze | A pause that pushes the membership end date back. |
| IST | India Standard Time. Every date rule in this document uses IST. |

## 1. What v3.0 fixes in v2.1

v2.1 fixed the big v1 issues (QR security, audit log, plans, consent, kids, receipts, timeline). This review found the gaps below. Each one is closed in the section listed.

| # | Gap in v2.1 | Why it matters | Fix in v3.0 |
| --- | --- | --- | --- |
| 1 | A plan is not linked to the classes it covers. A ₹3,000 Group plan could book ₹15,000 Adult Training classes. | Revenue leak, wrong bookings | Programs and plan entitlements (section 7) |
| 2 | Plan has one "class limit", but Kids needs 3 a week **and** 12 a month. | Rule cannot be built | Weekly cap plus credits per cycle (7.2) |
| 3 | Online class attendance is never captured. The scanner only works in the studio. | Wrong streaks, credits, no-show and reports for every online class | Online check-in by class code (ATT-8 to ATT-10) |
| 4 | Offline scanning "accepts the token and re-checks later". | Offline, a shared screenshot still works | Tokens signed with a public key the scanner checks offline (9.2) |
| 5 | The UPI link carries the amount but nothing that identifies the member. | Admin cannot tell who paid. This is the main daily pain. | Member code and plan in the UPI note, per-member QR (PAY-6, PAY-7) |
| 6 | Uploaded static QR must match the UPI ID, but a generated QR makes the upload unnecessary. | Extra work, and the "poor QR" risk stays | App generates the QR from the UPI ID. Upload is optional (PAY-3) |
| 7 | Reversing one of several queued payments has no rule. | Wrong end dates | Membership queue and re-chain rule (7.5) |
| 8 | Renewing during grace is not defined. | Free days or disputes | Renewal rules (7.4) |
| 9 | Member and Staff are separate tables, while parents, kids and coaches who train need one login model. | Duplicate people, broken parent flow | Account and Profile model (6.1, 12) |
| 10 | Coaches see the parent's phone (KID-6), but privacy says phones are admin-only. | Contradiction | Coaches get a tap-to-call button with a masked number, logged (KID-6) |
| 11 | Recurring classes are still post-launch. Coaches would re-type every class every day. | Coaches stop using the app | Series moved to Must (CLS-5) |
| 12 | No plan to bring existing members, their plans and paid-until dates into the app. | Everyone shows as Due on day one | Data migration module (MIG-1 to MIG-5) |
| 13 | Make-up classes are promised by policy but have no mechanism. | Policy cannot be applied | Make-up credits (BKG-9) |
| 14 | Trial classes are mentioned, but there is no trial flow or lead tracking. | New-member funnel is lost in WhatsApp | Leads and trials module (section 8.9) |
| 15 | Adult Training at ₹15,000 looks like personal training, which needs appointments, not group booking. | Wrong product built | Treated as small-batch fixed slots in v1, with a decision (Q1) |
| 16 | Login codes go by WhatsApp or SMS, but reminders go by email only. Channels are inconsistent. | Members miss reminders | One notification preference per account (MSG-2) |
| 17 | Email provider free tiers have daily caps, roughly 100 to 300 a day. Expected volume is about 250 a day. | Emails silently stop mid-day | Volume estimate and paid tier (13.4) |
| 18 | Data retention of 2 years conflicts with tax record rules. | Legal exposure | Split retention: personal data vs accounting (14.3) |
| 19 | Online classes for kids have no safety rules. | Child safety | KID-10 and KID-11 |
| 20 | No success metrics. | Nobody can tell if the app worked | Section 2.3 |
| 21 | No owner for each task. Owner, developer, accountant and lawyer could each assume someone else is doing it. | Missed launch items | Team and responsibilities (section 3) |
| 22 | No comparison with how other studios and studio software work. | Missing proven patterns | Benchmark (section 4) |
| 23 | Light theme has no tokens. Only dark is specified. | Inconsistent light mode | Both themes (section 10) |
| 24 | No studio holidays or class cancellation by the studio. | Credits and streaks break on closures | Closures (CLS-8) |
| 25 | v2.1 mixes answered and unanswered questions across sections 1A, 2 and 18. | Readers build different things | One decisions table and one open-questions table (section 5) |

## 2. Product summary

Unifit.hyd is a fitness studio in Hyderabad running online and offline classes for kids and adults. The product has three parts:

1. **Public website** (unifithyd.com): who we are, schedule, plans, trial sign-up, contact, legal pages.
2. **Member PWA** (app.unifithyd.com): register, book classes, check in, pay, see progress. Parents manage their children here.
3. **Staff and admin dashboard** (same PWA, staff role): coaches run classes and take attendance; admins manage members, payments, settings and reports.

Payments use the studio's own UPI ID. There is no payment gateway in v1. The admin verifies each payment.

### 2.1 Goals

- Replace WhatsApp groups, paper registers and UPI screenshots with one system for bookings, attendance and payments.
- A new member can register and book in under 2 minutes, including consent and the login code. A returning member books in under 15 seconds.
- Coaches set up their weekly timetable once and take attendance in under 2 seconds per person.
- The admin can see, any day, who attended, who has paid and who is due, and can match every payment to a member.
- The admin can change payment details safely without a developer.
- Installable on phones, works on weak signal, and follows the Unifit brand.

### 2.2 Non-goals for v1

Video hosting or recorded workouts; payment gateway, auto-debit or auto-reconciliation; native store apps; in-app chat; diet plans; appointment booking for one-to-one sessions (see Q1); multiple studio branches; marketplace listing on aggregator apps.

### 2.3 Success metrics (measured 8 weeks after launch)

| Metric | Target |
| --- | --- |
| Active members with an app account | 90% or more |
| Classes where attendance is taken in the app | 95% or more |
| Payments matched to a member without asking them | 90% or more |
| Median time from "I have paid" to verified | Under 24 hours |
| Admin time spent on payments per day | Under 20 minutes |
| No-show rate (booked but not attended) | Down by a third from the first two weeks |
| Members who are Due for more than 7 days | Down by half from launch week |
| Trial sign-ups that become paying members | Tracked from launch; target set after month 1 |

## 3. Team and responsibilities

So that everyone plans the same way, each area has one accountable person. R = does the work, A = accountable and signs off, C = consulted, I = kept informed.

| Area | Owner | Product lead | Developer | Designer | Coaches | Admin / front desk | Accountant | Lawyer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Business rules, plans, prices | A | R | C | | C | C | C | |
| This PRD and change control | C | A, R | C | C | I | I | | |
| UI design and brand | C | A | C | R | I | I | | |
| Build, test, deploy | I | A | R | C | | | | |
| Class timetable (data) | I | C | | | R | A | | |
| Existing member data for import | A | C | R (import) | | | R (collect) | | |
| Website copy and photos | A | R | C | C | C | | | |
| Terms, Privacy, Waiver, Refund policy | A | R (draft) | | | | | | C (review) |
| GST and receipts | A | C | R (build) | | | | C | |
| WhatsApp, SMS and email setup | A | R | R (integrate) | | | | | |
| Pilot testing | I | A | C | | R | R | | |
| Staff training | A | R | C | | I | I | | |
| Daily operations after launch | A | I | C (support) | | R | R | | |

If one person holds several roles (common for a small studio), keep the table anyway: it shows which hat they wear for each decision.

### 3.1 Deadlines for people outside the build

| Item | Owner | Needed by |
| --- | --- | --- |
| Answers to open questions (section 5.2) | Owner | End of week 1 |
| Existing member list with plan and paid-until date | Admin | End of week 4 |
| Weekly timetable for every program | Coaches and admin | End of week 3 |
| Business UPI ID and payee name | Owner | End of week 2 |
| WhatsApp Business number and SMS DLT registration started | Owner | Week 1 (approval can take weeks) |
| Legal documents reviewed | Lawyer | End of week 7 |
| Website photos and coach bios | Owner and coaches | End of week 6 |
| GST answer from accountant | Accountant | End of week 2 |

## 4. Benchmark: what similar studios and software do

This compares common patterns in studio-booking software (for example Mindbody, Glofox and Momence) and in how small Hyderabad studios run today. It is a pattern summary, not a feature audit of any one product.

| Pattern | Common practice | Unifit v1 decision |
| --- | --- | --- |
| Membership types | Unlimited plans, class packs (credits) and intro offers | Adopt: plans are either unlimited or credits per cycle, plus a weekly cap (7.2) |
| Late cancel and no-show | Late cancel or no-show uses the credit or charges a fee | Adopt credit use. No fees in v1. |
| Waitlist | Automatic promotion when a spot opens, with notification | Adopt as S (BKG-7) |
| Reminders | Automatic before class and before membership expiry | Adopt as M |
| Trial and lead tracking | Free or paid intro class, then follow-up until the person joins or drops | Adopt a simple leads list (8.9) |
| Self check-in | A tablet or a code at the front desk | Adopt: QR scan by coach plus a rotating class code |
| Online classes | Link revealed shortly before class to booked members only | Adopt (CLS-4) |
| Payments | Card or UPI gateway with auto-renew | Skip in v1. Manual UPI with strong matching. Revisit at the trigger in section 20. |
| Coach pay reports | Classes taught and attendance per coach | Adopt as S (ADM-6) |
| Referrals and loyalty | Referral credit, milestones | C, after launch |
| Local habit today | WhatsApp group for schedule, UPI screenshot sent to owner, paper register | Replace each with app features, keep a WhatsApp click-to-chat button for questions |

**Lessons taken:** most studio churn comes from missed renewals and no-shows, so reminders, credits and expiry notices are Must. Most admin time goes into matching payments, so payment identification is Must.

## 5. Decisions and open questions

### 5.1 Decided

| Topic | Decision | Source |
| --- | --- | --- |
| Main logo | Dark version | Owner |
| Plans and prices | Kids Training ₹3,000 a month (3 a week, 12 a month); Adult Training ₹15,000 a month; Group Classes ₹3,000 a month | Owner |
| Kids | Allowed through a parent or guardian account | Owner |
| Login | Email address identifies the account. One-time code by WhatsApp, SMS or email. Staff add a password and a code. | Owner |
| Coaches | Added by admin by email. Photos later. | Owner |
| Domain | unifithyd.com in the owner's name | Owner |
| Stack | React, Node.js, Express, Prisma, MySQL 8 | Owner |
| Billing | Numbered receipts, no GST yet, GST fields ready | Owner |
| Cancel cut-off | Free until 2 hours before. Later cancel or no-show uses the credit. | Proposed in v2.1, owner to confirm |
| Refunds | Full refund within 3 days of payment if no class attended; otherwise owner's discretion | Proposed in v2.1, owner to confirm |
| Carry-over | None. Studio-cancelled classes give a make-up credit. | Proposed in v2.1, owner to confirm |
| Grace | 3 days, warn only | Proposed in v2.1, owner to confirm |
| Freeze | One per membership, up to 14 days, admin only | Proposed in v2.1, owner to confirm |
| Cycle | Counted from payment start date, not calendar month | Default in v2.1 |
| Coach-generated code | Rotating class code for check-in (option a in v2.1) | Recommended; used for online check-in |
| Payment model | Manual UPI, business UPI ID, per-member QR | This version |

### 5.2 Open questions (each has a default so work is not blocked)

| # | Question | Default if no answer | Blocks |
| --- | --- | --- | --- |
| Q1 | Adult Training at ₹15,000: personal (one-to-one) or small batch? Classes per week? Batch size? | Small batch, fixed timetable, up to 6 people, unlimited classes in that program | Plan setup, CLS |
| Q2 | Group Classes: who can join (kids, adults, both), how many a week? | Adults only, unlimited | Plan setup |
| Q3 | Does any plan cover more than one program (for example Adult Training includes Group)? | Yes: Adult Training also covers Group Classes | Entitlements |
| Q4 | Discounts for 3, 6 or 12 months? | None in v1; the plan model supports them | Pricing page |
| Q5 | Free trial class? One per phone number? | One free trial per phone number, any program except Adult Training | Leads |
| Q6 | Message provider and monthly budget? | Email at launch; WhatsApp added when the template is approved; budget cap ₹1,500 a month | MSG |
| Q7 | Public website in scope at launch? | Yes, simple version (section 8.13) | Phase 2 |
| Q8 | Show prices publicly on the website? | Yes for Kids and Group; Adult Training says "from ₹15,000, ask us" | WEB-2 |
| Q9 | Block check-in for Due members? | No, warn only; admin can switch it on | ATT-5 |
| Q10 | Can coaches see Paid or Due? | Status only, never amounts | Permissions |
| Q11 | Should a parent be able to attend as a member too? | Yes, same account, own profile | Accounts |
| Q12 | Where to host? | One small VPS or managed Node host in India or Singapore region, managed MySQL if budget allows | Phase 0 |

## 6. Users, accounts and permissions

### 6.1 Account and profile model

- One **account** per adult who logs in. Identified by email; phone is verified and used for codes.
- An account has one or more **profiles**. An adult member has their own profile. A parent has one profile per child, and optionally their own.
- An account has one or more **roles**: member, coach, admin, owner. A coach who also trains has the member role and a profile.
- Exactly one account holds the **owner** role. It cannot be removed or demoted by anyone else.
- Memberships, bookings, attendance and payments attach to a **profile**, never to an account. A parent pays for each child separately.

### 6.2 Permissions

All checks run on the server. Hiding a button is not a permission check.

| Capability | Member (parent) | Coach | Admin | Owner |
| --- | --- | --- | --- | --- |
| Register, log in, edit own account | Yes | Yes | Yes | Yes |
| Add and manage own child profiles | Yes | Own | Own | Own |
| View and book classes | Own profiles | Own profiles | Any profile | Any profile |
| See own QR, fitness data, receipts | Own profiles | Own profiles | Any profile | Any profile |
| Create, edit, cancel classes and series | No | Own programs | All | All |
| View roster | No | Own classes | All | All |
| Take attendance | No | Own classes, plus classes they cover | All | All |
| See Paid or Due status | Own profiles | Status only, own classes (Q10) | Yes | Yes |
| See phone numbers | Own | Masked, tap to call, logged | Yes | Yes |
| Verify and record payments, issue receipts | No | No | Yes | Yes |
| Members, plans, freezes, make-up credits | No | No | Yes | Yes |
| Change UPI details | No | No | Yes, re-authenticate | Yes, re-authenticate |
| Audit log, message log, reports | No | Own classes report | Yes | Yes |
| Manage coaches and admins | No | No | No | Yes |
| Export or delete all data | No | No | No | Yes |

## 7. Programs, plans and membership rules

This is the core business logic. Build it as one service module with unit tests for every example in 7.6.

### 7.1 Programs

| Program | Audience | Mode | Default capacity |
| --- | --- | --- | --- |
| Kids Training | Kids (under 18) | Offline or online | 15 |
| Adult Training | Adults | Offline or online | 6 (Q1) |
| Group Classes | Adults (Q2) | Offline or online | 20 |

Admins can add programs later. Each class belongs to exactly one program. A program's audience decides which profiles may book.

### 7.2 Plans and entitlements

A plan has: name, price (paise), cycle length (1 month; 3, 6, 12 later), programs covered (one or more), credits per cycle (blank = unlimited), weekly cap (blank = none), audience, public flag, active flag.

| Plan | Price | Programs covered | Credits per cycle | Weekly cap |
| --- | --- | --- | --- | --- |
| Kids Training | ₹3,000 (300000 paise) | Kids Training | 12 | 3 |
| Adult Training | ₹15,000 (1500000 paise) | Adult Training, Group Classes (Q3) | Unlimited (Q1) | None |
| Group Classes | ₹3,000 (300000 paise) | Group Classes | Unlimited (Q2) | None |

**Rules**

- A booking is allowed only if the profile has a membership that is active or in grace on the class date, and that plan covers the class's program.
- A booking uses one credit when made. Cancelling before the cut-off returns it. A late cancel or no-show keeps it used.
- The weekly cap counts bookings (not late-cancelled) in Monday to Sunday IST of the class date.
- Credits are counted per cycle of the membership the booking uses, by the class date, not the booking date.
- A class can be booked only within the membership dates. A member cannot book next cycle's classes before paying for it.
- The app always shows "X classes left this cycle, Y this week".

### 7.3 Membership statuses

| Status | Meaning | Can book | Check-in shows |
| --- | --- | --- | --- |
| Pending | Payment submitted, not verified | No (a trial booking still works) | "Payment pending" |
| Scheduled | Paid, starts in the future | Classes on or after its start | — |
| Active | Today within start and end | Yes | Paid |
| Grace | Up to 3 days after end, no renewal | Yes | "Renew soon" warning |
| Due | After grace, no renewal | No | Due warning (or block if Q9) |
| Frozen | Inside a freeze | No | Frozen |
| Cancelled | Reversed or refunded | No | — |

A **trial** is a single free booking, not a membership (8.9).

### 7.4 Start dates and renewal

- First payment: membership starts on the payment date (or a date the admin picks, not earlier than 7 days back).
- Renewal while active or in grace: the new period starts the day after the current end date. Grace days are not free.
- Renewal after grace (Due): the new period starts on the payment date. Missed days are not owed.
- A cycle is one calendar month from the start date. If the start is the 31st, a short month ends on its last day.

### 7.5 Queued memberships, reversal, refund and freeze

- Each verified payment creates exactly one membership period. Periods for the same plan and profile form a chain with no gaps.
- **Reversal** (payment found to be wrong): the period is cancelled. Later periods in the chain move earlier so the chain has no gap. Bookings that now fall outside any period are flagged to the admin, not deleted.
- **Refund**: same as reversal, plus a credit note (BILL-6) and the refund amount and method recorded.
- **Freeze**: start date and number of days (1 to 14). The end date moves later by that many days, and later periods in the chain move with it. Bookings inside the freeze are cancelled with credits returned.
- Every one of these actions needs a reason and writes to the audit log.

### 7.6 Worked examples (become unit tests)

1. Kids plan, start 10 March. Cycle 1 is 10 March to 9 April. The child books Mon, Wed, Fri: allowed. A 4th booking that week: refused, "Weekly limit of 3 reached".
2. Same child, 12 bookings in cycle 1 by 30 March: 13th refused, "No classes left this cycle".
3. Child cancels a Wed class 3 hours before: credit back. Cancels 1 hour before: credit stays used.
4. Adult renews 2 days before end (end 31 May): new period 1 June to 30 June.
5. Adult pays on 6 June after end 31 May (grace ended 3 June): new period 6 June to 5 July.
6. Two queued periods, April and May. April payment is reversed: May's period moves to start on the original April start date.
7. Freeze of 10 days starting 15 April on a period ending 30 April: end becomes 10 May.
8. Studio cancels a Kids class: all booked children get the credit back plus one make-up credit valid to the end of the next cycle.
9. Group member tries to book an Adult Training class: refused, "Your plan does not include Adult Training".

## 8. Functional requirements

### 8.1 Accounts and login

- ACC-1 (M): Register with name, email, phone (+91, 10 digits) and date of birth for each profile. A person under 18 can only be added as a child profile by an adult.
- ACC-2 (M): Member codes (UF0001) come from a database sequence. They are labels for humans, never proof of identity.
- ACC-3 (M): Login by one-time 6-digit code. The member picks WhatsApp, SMS or email; email always works as a fallback. Codes expire in 10 minutes, are single-use, allow 5 tries, and are limited to 5 sends per hour per phone and per email, and 20 a day. No magic links (they open in the browser instead of the installed app on iPhone).
- ACC-4 (M): Staff log in with a password (Argon2id) plus a one-time code. Admin and owner sessions expire after 12 hours of inactivity; member sessions last 90 days with refresh and remote logout.
- ACC-5 (M): At registration the account holder accepts Terms, Privacy Policy, Health Waiver and Refund Policy. Version and time are stored per profile.
- ACC-6 (M): Duplicate email or phone is rejected with a clear message and a "log in instead" link.
- ACC-7 (M): Members can edit their details, download their data and request deletion. Deletion is done by an admin within 30 days (14.3).
- ACC-8 (S): Admin can disable an account. Disabled accounts cannot log in; their history stays.
- ACC-9 (M): Optional profile photo, used by the scanner to confirm identity. Children's photos only with parental consent (KID-7).

### 8.2 Kids and guardians

- KID-1 (M): A child profile belongs to one parent account. A second guardian can be invited by the first, with the same rights.
- KID-2 (M): The parent accepts all documents for each child. Consent is stored separately from the child's profile, with version and time.
- KID-3 (M): Children have no login. The parent's phone shows each child's QR, with a switcher between children.
- KID-4 (M): Child profiles keep only bookings, attendance, membership and an optional emergency note. No weight log, no measurements, no ranking, no marketing.
- KID-5 (M): Kids book only Kids or Mixed classes; adults only Adult or Mixed (program audience).
- KID-6 (M): Coaches see the child's first name, last initial and a "Call parent" button for their own classes. The number is not shown in full. Each call tap is logged.
- KID-7 (M): Use of a child's photo on the website or social media needs a separate opt-in. Default off.
- KID-8 (S): Optional emergency contact and health note, visible to the admin and the class coach only.
- KID-9 (M): On the 18th birthday the profile is offered a move to its own adult account. Until the new account accepts the documents, the parent stays in control.
- KID-10 (M): Online kids classes: the link goes only to the parent's account, the class must not be recorded by the studio, and the coach must not message children directly.
- KID-11 (M, studio policy): Police verification for coaches who teach children, and two-adult rule for online kids classes where practical.

### 8.3 Classes and schedule

- CLS-1 (M): A class has program, title, start (stored UTC, shown IST), duration, mode (Online or Offline), location with map link or meeting link, capacity, coach, notes and status (scheduled, cancelled, completed).
- CLS-2 (M): Coaches create classes for their own programs; admins for all.
- CLS-3 (M): Members see upcoming classes, today first, filtered by what their plan covers, with spots left, mode badge and program.
- CLS-4 (M): Meeting links are shown only to booked profiles and only from 30 minutes before start. Offline classes show location and map link.
- CLS-5 (M): **Series:** weekly repeat on chosen days and time, with an end date or open-ended. The system creates classes 4 weeks ahead every night. Edit this class, or this and all future classes.
- CLS-6 (M): Changing time, mode, location or coach notifies everyone booked. A change of more than 1 hour, or of mode, lets members cancel without using a credit even after the cut-off.
- CLS-7 (M): Cancelling a class by the studio notifies everyone booked, returns credits, and gives one make-up credit to each booked profile on a limited plan.
- CLS-8 (M): **Closures:** admin marks a date or range as closed (holiday). Classes in it are cancelled as in CLS-7. Series skip closed dates. Streaks do not break on closed days.
- CLS-9 (S): Substitute coach: admin assigns another coach to one class. That coach gets roster and attendance rights for it.

### 8.4 Booking

- BKG-1 (M): Book and cancel. Inside one database transaction the server locks the class row, checks capacity, entitlement (7.2) and duplicates, then writes. A unique key on (class, profile) blocks double booking.
- BKG-2 (M): Booking closes at class start for offline and 5 minutes after start for online.
- BKG-3 (M): Cancellation cut-off is a setting (default 2 hours). The app says before cancelling whether the credit will be returned.
- BKG-4 (M): Confirmation and cancellation messages on the member's chosen channel.
- BKG-5 (M): Automatic reminder 2 hours before class (setting). Not sent for bookings made inside that window.
- BKG-6 (M): After a class ends, bookings without a check-in become no-show at the end of the day. Coaches can correct attendance until 24 hours after the class.
- BKG-7 (S): Waitlist: when a spot opens, the first waiting profile is booked automatically if it still has an entitlement, and notified. Waitlist closes 2 hours before start.
- BKG-8 (M): A parent can book several children into the same class in one step.
- BKG-9 (M): **Make-up credits:** an extra credit with an expiry date, used before normal credits. Created by CLS-7 or by an admin with a reason.
- BKG-10 (S): Walk-in: staff can add a profile to a class at the door if there is capacity and an entitlement.

### 8.5 Attendance

- ATT-1 (M): Each profile has a QR made from a signed, short-lived token (section 9). The member code is never enough on its own.
- ATT-2 (M): The coach picks the class (today's own classes first) and scans. The screen shows photo or initials, name, program, Paid, Grace or Due, and credits left. Scan to result in under 1 second.
- ATT-3 (M): A second scan of the same profile for the same class shows "Already checked in at 6:02 pm".
- ATT-4 (M): Scanning a profile who did not book offers "Add as walk-in" (BKG-10) if allowed, otherwise explains why not.
- ATT-5 (M): Due members show a warning. If the admin turns on blocking (Q9), the check-in is refused with "Please see the front desk".
- ATT-6 (M): **Offline scanning:** before class the scanner downloads the roster, member statuses and the public key. Scans are verified on the device, saved, and synced when online. A banner shows the number of scans waiting.
- ATT-7 (M): Manual check-in by staff only, by searching name or code, with a required reason. Logged with who and when.
- ATT-8 (M): **Class code:** for each class the coach can show a 4-digit code that changes every 60 seconds. Members tap Check in on their booking and type the code. Valid from 10 minutes before start to 20 minutes after.
- ATT-9 (M): **Online classes** use the class code (the coach shows it on screen). Tapping the meeting link also records "joined" as a helper for the coach, but only the code or a coach mark counts as attended.
- ATT-10 (M): After an online class the coach sees who booked, who joined and who checked in, and can confirm or correct in one screen.
- ATT-11 (M): Every change to attendance after the class is logged.

### 8.6 Payments (manual UPI)

**Admin settings**

- PAY-1 (M): Admin sets the UPI ID and payee name. Format check: a handle, then @, then the bank or app handle. A business or merchant UPI ID is strongly recommended; some UPI apps limit or flag pre-filled payments to personal IDs.
- PAY-2 (M): Changing UPI details needs password plus a fresh code, shows old and new values side by side, writes to the audit log, emails and messages every admin and the owner, and takes effect 15 minutes later unless the owner confirms sooner. The delay lets the owner stop a change made from a stolen account.
- PAY-3 (S): Optional upload of the bank-issued QR (PNG, JPG, WebP up to 2 MB, re-encoded, metadata stripped). The server decodes it and refuses to save if its UPI ID differs from PAY-1. If no upload exists, the app generates the QR itself.
- PAY-4 (M): If no UPI ID is set, the Pay screen says "Payment details coming soon, please contact the studio" with the WhatsApp button.

**Member payment screen**

- PAY-5 (M): The Pay screen lists the profile's current plan first and other plans it can buy, then the status: Paid until a date, Grace, Due, or Pending verification.
- PAY-6 (M): For the chosen plan the app builds a UPI link with the UPI ID, payee name, exact amount, INR, and a note in the form `UF0023 KIDS MAR` (member code, plan short code, cycle month). It shows this as a QR, an "Open UPI app" button on phones, and Copy buttons for the UPI ID and the note.
- PAY-7 (M): The app tells the member, in one line, to keep the note as it is. Most UPI apps carry it into the payee's statement, which is how the admin matches the payment.
- PAY-8 (M): After paying, the member taps "I have paid" and enters the 12-digit UTR, with an optional screenshot (image only, 2 MB). The server rejects a UTR already used. This creates a Pending payment.
- PAY-9 (M): A parent can pay for several children in one UPI payment. The note lists the member codes; the pending payment is split per child.

**Admin verification**

- PAY-10 (M): Pending payments list, oldest first, showing member, plan, amount, UTR, note, screenshot and how long it has waited. Verify or reject with a reason in one tap.
- PAY-11 (M): Admin can also record a payment directly (cash, or UPI without a submission): profile, plan, amount, date, method, UTR or note.
- PAY-12 (M): Verifying creates the membership period (7.4), issues a receipt and notifies the member.
- PAY-13 (M): An amount different from the plan price needs a reason (discount, part payment). Part payments do not start a membership until the full amount is reached.
- PAY-14 (M): Reversal and refund follow 7.5. Nothing is hard-deleted.
- PAY-15 (M): Expiry reminders 3 days before the end, on the last day, and on the first Due day. One message each, never repeated.
- PAY-16 (M): Daily summary to the admin at 9 am: pending payments, members entering Due today, members in grace.
- PAY-17 (S): Monthly bank statement check: admin uploads the bank or UPI app statement as CSV; the app suggests matches by UTR, amount and note. Admin confirms each match. Nothing is verified automatically.

### 8.7 Receipts and billing

- BILL-1 (M): Every verified payment creates a receipt numbered UF-YYYY-NNNN from a database sequence that never repeats or resets mid-year.
- BILL-2 (M): Receipt shows studio name and address, member, profile, plan, period, amount, method, UTR and date. Titled "Receipt", no tax lines while not GST-registered.
- BILL-3 (M): GST number, rate and tax lines exist in settings, off by default. Switching on affects future receipts only. Ask the accountant before turning on (14.4).
- BILL-4 (M): Receipts are PDFs, sent to the member and downloadable at any time. Admin can resend.
- BILL-5 (S): Monthly export for the accountant: receipts, credit notes, refunds, totals by plan and method.
- BILL-6 (M): A reversal or refund creates a credit note numbered UF-CN-YYYY-NNNN that refers to the original receipt. Receipts are never edited or deleted.

### 8.8 Notifications

- MSG-1 (M): Message types: login code, welcome, booking confirmed, booking cancelled, class changed, class cancelled, reminder, waitlist promoted, payment pending received, payment verified with receipt, payment rejected, expiry reminders, freeze applied, admin alerts.
- MSG-2 (M): Each account picks one channel for non-urgent messages: WhatsApp, SMS or email. Login codes and payment receipts also go by email. If the chosen channel fails, the message goes by email.
- MSG-3 (M): Every message is logged with channel, template, status (queued, sent, delivered, failed), attempts and time. Failures retry 3 times with backoff. Bounced emails and blocked numbers are flagged on the account.
- MSG-4 (M): Templates use the brand colours and logo (emails) and are pre-approved where the channel requires it (WhatsApp, SMS DLT).
- MSG-5 (M): Scheduled jobs are idempotent: each message has a unique key (type, profile, class or membership, date) so a job that runs twice sends nothing twice.
- MSG-6 (M): Quiet hours 9 pm to 7 am for non-urgent messages, except reminders for classes before 9 am, which go at 8 pm the night before.
- MSG-7 (M): A WhatsApp click-to-chat button to the studio number on the app and website.
- MSG-8 (S): Admin edits template text in settings. Variables are escaped.
- MSG-9 (C): Push notifications for installed apps (Android, iOS 16.4 or later).

### 8.9 Leads and trials

- LEAD-1 (M): Trial sign-up form on the website and in the app: name, phone, program of interest, preferred time, for whom (self or child, with child's age).
- LEAD-2 (M): One free trial per phone number (Q5). The form offers the next 5 trial-eligible classes; picking one books the trial and creates the account in one step.
- LEAD-3 (M): Leads list for the admin with status: new, trial booked, attended, joined, lost (with reason). Follow-up date and notes.
- LEAD-4 (M): After an attended trial, the person gets the plan options and Pay link the same day, and a follow-up reminder appears for the admin after 2 days.
- LEAD-5 (S): Source field (Instagram, Google, walk-in, referral) for simple funnel numbers.
- LEAD-6 (M): Spam protection on public forms (rate limits plus a hidden-field or privacy-friendly challenge).

### 8.10 Member progress

- FIT-1 (M): Dashboard per profile: classes attended this cycle and all-time, current streak in weeks (a week counts if at least one class was attended; closures do not break it), upcoming bookings, credits left.
- FIT-2 (M): Adults can log weight with a simple trend chart. Optional, private, never shown to coaches.
- FIT-3 (C): More measurements and goals.
- FIT-4 (C): Attendance milestones (10, 25, 50, 100 classes).

### 8.11 Admin dashboard and reports

- ADM-1 (M): Today cards: active members, in grace, Due, pending payments, classes today, checked in today, collected this month.
- ADM-2 (M): Today's schedule with booked, checked-in and capacity per class.
- ADM-3 (M): Member list with search by name, code or phone, filters by program, plan, status and Due days.
- ADM-4 (M): Member detail: profiles, memberships chain, bookings, attendance, payments, receipts, consents, messages, audit trail, and actions (record payment, freeze, make-up credit, disable).
- ADM-5 (S): Reports by date range, program and mode: attendance, no-shows, revenue by plan, new members, renewals and churn. CSV export.
- ADM-6 (S): Coach report: classes taught, average attendance, by month.
- ADM-7 (M): Settings: studio info, UPI (PAY-1 to PAY-3), cut-off, reminder time, grace days, block-if-due, closures, plans, programs.
- ADM-8 (M): Staff management (owner only): invite coach or admin by email, assign programs to coaches, disable staff.

### 8.12 Coach tools

- COA-1 (M): Home screen: today's own classes with booked count, one tap to roster, scanner and class code.
- COA-2 (M): Weekly timetable management through series (CLS-5).
- COA-3 (M): Send a short message to everyone booked in one of their classes (uses MSG-2 channels, logged).
- COA-4 (M): Coaches cannot see payments, amounts, full phone numbers, weight logs or other coaches' rosters.

### 8.13 Public website

- WEB-1 (M): Pages: Home, Programs, Schedule (read-only, from the live timetable, no meeting links), Plans, Coaches, Trial sign-up, Contact (map, phone, WhatsApp), FAQ, Terms, Privacy, Waiver, Refund and Cancellation policy.
- WEB-2 (M): Plans and schedule come from the same database as the app (Q8 decides which prices are shown).
- WEB-3 (M): Local SEO: titles, descriptions, LocalBusiness structured data, sitemap, Google Business Profile link. Loads fast on 4G.
- WEB-4 (S): Privacy-friendly analytics without cookie banners.
- WEB-5 (C): Gallery and transformation stories, only with written consent.

### 8.14 Data migration (new)

- MIG-1 (M): A CSV template for existing members: account holder name, email, phone, profile name, date of birth, program, plan, paid-until date, last amount paid, notes.
- MIG-2 (M): Import runs on staging first. The admin reviews a preview with errors (duplicate phone, missing date of birth, unknown plan) before the real import.
- MIG-3 (M): Each imported member gets an opening membership ending on their paid-until date, marked "imported", with no receipt.
- MIG-4 (M): After import, each account gets an invite message to set up login and accept the documents. Imported members who do not accept cannot book after a 14-day transition.
- MIG-5 (M): The coaches' current weekly timetable is entered as series before launch.

## 9. Attendance QR design

### 9.1 Online case

- The member's app asks the server for a token every 60 seconds while the QR screen is open. The token holds profile ID, issue time, expiry (90 seconds) and a random ID, signed with the server's Ed25519 private key.
- The QR encodes only the token. It reveals nothing about the person without the server.
- The scanner sends the token to the server, which checks signature, expiry, booking and status, records the check-in and returns the result.

### 9.2 Offline case

- **Scanner offline:** the scanner has the public key and the class roster downloaded earlier (ATT-6). It checks the signature and expiry on the device, matches the profile to the roster, and queues the check-in with a device scan ID. On sync, the server re-checks; a unique key on (class, profile) and the device scan ID make re-sending safe.
- **Member offline:** when the app last had signal it saved a day token, valid until the end of that IST day and only for that profile. The QR screen shows "Offline pass" and the scanner accepts it with a small "offline pass" tag. This is the one place a screenshot could be shared, limited to one day.
- **Both offline:** works, as long as the scanner downloaded the roster and the member's app saved a day token.
- If nothing works: staff manual check-in with a reason (ATT-7) or the class code once signal returns (ATT-8).

### 9.3 Key handling

- The private key lives only on the server, in an environment secret. Keys rotate every 6 months; the scanner accepts the current and previous public key.

## 10. Brand and design system

The dark logo is the main mark: white and green "U" on deep navy, wordmark uni**fit**.hyd with ".hyd" in soft blue. The light logo is for white backgrounds and print. Get the logo as SVG from the designer; the PNGs in docs/ are not enough for crisp icons.

### 10.1 Colour tokens

| Token | Dark theme (default) | Light theme | Use |
| --- | --- | --- | --- |
| bg | #0B1F3F | #F5F7FB | Page background |
| surface | #12335F | #FFFFFF | Cards, headers, sheets |
| border | #24497A | #D9E1EC | Dividers, inputs |
| text | #FFFFFF | #12335F | Headings and body |
| text-muted | #9FB4D3 | #4A5D78 | Captions, hints |
| brand-green | #4AA82A | #4AA82A | Logo, icons, large text, success fill on dark |
| action | #4AA82A with navy text #0B1F3F | #2E7D1A with white text | Primary buttons (both pass 4.5:1) |
| link / online | #6FA8F0 | #2A6FC4 | Links, Online badge |
| danger / due | #FF7A5C | #C23118 | Due, errors |
| warning / grace | #F5C518 | #8A6A00 | Grace, attention |
| focus ring | #F5C518 | #2A6FC4 | Keyboard focus |

Check every pair against 4.5:1 for normal text in the build (an automated contrast test in CI). Never show a status by colour alone: add an icon and a word.

### 10.2 Layout and type

Mobile-first, 4 bottom tabs for members (Classes, My QR, Pay, Me), staff get a role switcher. Rounded cards (12 px), 44 px touch targets. Poppins (bold, slanted feel) for headings, system sans-serif for body. Mode badges: "Online" (link colour) and "Studio" (green). Light mode follows the phone setting and can be overridden in Me.

### 10.3 Icons

App icons 192 and 512 px, maskable with the "U" inside the central 80% safe zone, Apple touch icon 180 px, favicon. Dark navy background with the white and green "U".

## 11. PWA requirements

- PWA-1 (M): Manifest: name "Unifit.hyd", short name "Unifit", theme and background colour #0B1F3F, standalone, start URL /, icons from 10.3.
- PWA-2 (M): Service worker caches the app shell and the last data (classes, own bookings, QR day token, scanner roster). Offline banner on every screen.
- PWA-3 (M): Offline: viewing and QR work; scanning queues (ATT-6); booking, cancelling and payments are disabled with a clear message.
- PWA-4 (M): New version prompt ("Update available, tap to reload"), never a silent half-update.
- PWA-5 (M): HTTPS only. Install prompt on Android, Add to Home Screen guide on iPhone, shown once after the first booking.
- PWA-6 (M): Camera permission is asked only when the scanner opens, with a clear message if refused and a link to manual check-in.

## 12. Data model

MySQL 8 with Prisma. All tables have id, created_at, updated_at. Money in paise (integer). Times in UTC; dates that mean "a day" (membership dates, closures) are stored as DATE in IST.

| Table | Key fields | Constraints |
| --- | --- | --- |
| Account | email, phone, phone_verified, password_hash (staff), roles, channel_pref, disabled | email unique, phone unique |
| Profile | account_id, member_code, name, dob, kind (adult/child), photo, emergency_note | member_code unique (sequence) |
| Guardian | account_id, profile_id, role (primary/second) | unique (account, profile) |
| Consent | profile_id, accepted_by_account_id, document, version, accepted_at, ip | append-only |
| Program | name, audience, default_capacity, active | |
| Plan | name, short_code, price_paise, cycle_months, credits_per_cycle, weekly_cap, audience, public, active | |
| PlanProgram | plan_id, program_id | unique pair |
| Membership | profile_id, plan_id, payment_id, start_date, end_date, status, source (paid/imported), chain_seq | |
| Freeze | membership_id, start_date, days, reason, by | |
| CreditAdjustment | profile_id, membership_id, delta, kind (makeup/manual), expires_on, reason, by | |
| ClassSeries | program_id, coach_id, title, weekdays, start_time_ist, duration, mode, location_or_link, capacity, from_date, until_date | |
| Class | series_id, program_id, coach_id, start_utc, duration, mode, location_or_link, capacity, status, notes | |
| Closure | from_date, to_date, reason | |
| Booking | class_id, profile_id, membership_id, status (booked/cancelled/late_cancelled/attended/no_show/trial), credit_used, makeup_used, cancelled_at | unique (class, profile) |
| Waitlist | class_id, profile_id, position | unique (class, profile) |
| Attendance | class_id, profile_id, method (qr/qr_offline/code/manual/walkin), by_account_id, at, device_scan_id, reason | unique (class, profile); device_scan_id unique |
| Payment | profile_id, plan_id, amount_paise, method, utr, upi_note, proof_file, status (pending/verified/rejected/reversed/refunded), batch_id, verified_by, reason | utr unique when not null |
| Receipt | number, kind (receipt/credit_note), payment_id, refers_to, pdf_file, gst_fields | number unique |
| Lead | name, phone, for_child_age, program, source, status, follow_up_on, notes, trial_booking_id | |
| LoginCode | account_id, channel, code_hash, expires_at, attempts | |
| Session | account_id, refresh_hash, device, expires_at, revoked_at | |
| MessageLog | account_id, channel, template, dedupe_key, status, attempts, provider_id, sent_at | dedupe_key unique |
| Setting | key, value, updated_by | |
| AuditLog | actor, action, entity, entity_id, old_value, new_value, ip, at | append-only |

## 13. Architecture, hosting and cost

### 13.1 Stack

- **Frontend:** React with Vite, vite-plugin-pwa (Workbox), React Router, a small component library styled with the tokens in section 10. One app serves member and staff screens by role.
- **Website:** static pages built from the same repo (pre-rendered for SEO) reading public schedule and plans from the API.
- **API:** Node.js LTS, Express, Prisma, zod validation, one service per module (accounts, schedule, booking, attendance, payments, billing, messages, leads).
- **Database:** MySQL 8, InnoDB, transactions for booking, attendance and payments.
- **Jobs:** a scheduler process (node-cron or a job queue on the database) for series generation, reminders, no-show marking, expiry notices and the daily summary. Every job is idempotent (MSG-5).
- **Files:** object storage or a private folder outside the web root for proofs and receipts, served only through signed, short-lived links.
- **QR:** a QR generator library for member tokens and UPI QR; a camera scanner library (for example jsQR or a ZXing build) for the scanner; Ed25519 signing on the server and a small verification library in the scanner.
- **PDF:** server-side receipt PDFs from an HTML template.

### 13.2 Environments

Local, staging and production, each with its own database, keys, UPI test values and message sandbox. Staging is where the pilot runs. Migrations in version control; no manual database edits in production.

### 13.3 CI and code quality

Lint, type check (TypeScript recommended), unit and API tests on every push. Automatic deploy to staging from the main branch; manual promote to production. Error tracking (for example Sentry) and uptime monitoring from day one.

### 13.4 Volume and cost estimate

Assumptions: 300 profiles, 8 classes a day, 15 bookings per class.

| Item | Estimate | Note |
| --- | --- | --- |
| Messages per day | About 250 (120 confirmations, 120 reminders, plus codes and payments) | Over most email free tiers' daily cap; plan for a paid tier or a provider with a higher free limit |
| Hosting | Small VPS or managed Node host plus MySQL | Choose an India or Singapore region for speed |
| Domain and email DNS | Yearly domain fee | SPF, DKIM, DMARC required |
| WhatsApp and SMS | Per-message charges | Get current quotes from 2 providers; cap in settings (Q6) |
| Backups | Daily, kept 30 days, copied off the server | Restore test before launch |

Check current prices and free-tier limits when signing up; they change often. The product lead records the monthly total for the owner before launch.

## 14. Security, privacy and legal

### 14.1 Security

- Server-side role and ownership checks on every endpoint, covered by API tests (one test per row of the permissions table).
- Rate limits on login, codes, bookings, uploads and public forms. Lockout after repeated failures with an alert to the owner.
- Staff two-step login. Re-authentication for UPI changes, staff changes and data exports.
- Cookies httpOnly, Secure, SameSite=Lax; CSRF protection; strict Content Security Policy; HTTPS with HSTS.
- Uploads: type checked by content, size limited, re-encoded, renamed, stored privately.
- Secrets only in environment variables. No real member data on developer machines; staging uses fake data except during the pilot.
- Dependency audit in CI. OWASP Top 10 review before launch.

### 14.2 Privacy (DPDP Act 2023 and Rules 2025)

- Collect only what each feature needs. A plain-language notice at sign-up says what is collected and why.
- Verifiable parental consent for children (KID-2). No tracking, profiling or advertising for children.
- Members can see, correct, export and request deletion of their data. Requests answered within 30 days.
- A named person handles privacy requests and complaints (the owner, unless delegated). Contact shown in the Privacy Policy.
- Breach plan: who is told, within what time, and the template message. Practise it once before launch.
- The Rules phase in over time, with key duties reported to apply from May 2027. Build for them now and have a lawyer confirm current duties before launch.

### 14.3 Retention

| Data | Kept for | Then |
| --- | --- | --- |
| Receipts, credit notes, payments | At least 6 years (tax and GST record rules; accountant to confirm) | Keep, with the person's name only as required |
| Profiles, bookings, attendance, weight | 2 years after last activity, or until a deletion request | Delete or anonymise |
| Consents | As long as the data they cover, plus 1 year | Delete |
| Message bodies | 90 days | Keep only the log line |
| Payment screenshots | 1 year | Delete |
| Audit log | 6 years | Archive |

### 14.4 Legal and tax checklist

- Terms of Service, Privacy Policy, Health and Liability Waiver, Refund and Cancellation Policy: drafted by the product lead from the decisions in section 5, reviewed by a lawyer.
- GST: registration is reported to be required once yearly service turnover passes ₹20 lakh, and gym and fitness services are reported at 5% since September 2025. At current prices this can be reached with a small number of Adult Training members. The accountant must confirm before launch; BILL-3 is ready.
- WhatsApp Business verification and SMS DLT registration (sender ID and templates) in the studio's name.

## 15. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | First load under 3 s on 4G on a mid-range Android phone; repeat load under 1 s; scan result under 1 s online |
| Capacity | 300 people tapping Book on the same class within 5 seconds without overbooking or errors |
| Availability | 99.5% monthly, measured by uptime monitor; planned maintenance outside 5 am to 10 pm |
| Reliability | Daily backups, point-in-time recovery if the host offers it, tested restore; jobs safe to rerun |
| Accessibility | Contrast 4.5:1, 44 px targets, labels on all fields, screen reader and keyboard support, no colour-only status, Lighthouse accessibility 90 or above |
| Compatibility | Latest 2 versions of Chrome Android, Safari iOS, Chrome and Edge desktop; tested on one low-end Android phone and one iPhone |
| Language | English at launch; text kept in one file so Telugu and Hindi can be added later |
| Observability | Error tracking, uptime alerts to the owner and developer, structured logs kept 30 days, a daily job report |
| Time | All rules in IST; server and database in UTC |

## 16. Key user flows

1. **New member from the website:** Trial sign-up → pick a class → enter phone, get code → account created, trial booked → attend, coach scans → same day, plans and Pay link arrive → pays with the note filled → taps "I have paid" with UTR → admin verifies → receipt and Paid status.
2. **Parent with two kids:** Register → add two child profiles → accept documents for each → pay one UPI payment for both (PAY-9) → book both into Wednesday's class in one step → show each child's QR at the door.
3. **Coach weekly setup:** Create series Mon, Wed, Fri 6 pm, Kids Training, Studio, capacity 15 → classes appear 4 weeks ahead → on the day open Home, tap the class, scan.
4. **Online class:** Member books → link appears 30 minutes before → joins → coach shows the class code → member types it → coach confirms the list after class.
5. **Offline studio:** Coach opens the class with Wi-Fi in the morning (roster downloaded) → no signal at class time → scans queue → sync later without duplicates.
6. **Renewal:** Expiry reminder 3 days before → member pays with the note → admin matches by note and UTR → new period starts the day after the old end date.
7. **UPI change:** Admin opens Settings → enters new UPI ID → password and code → owner gets an alert → change goes live after 15 minutes or on owner confirmation.
8. **Studio holiday:** Admin adds a closure → classes cancelled, credits returned, make-up credits given, members notified.

## 17. Acceptance criteria and test plan

### 17.1 Acceptance criteria

- The 16th booking on a capacity-15 class is refused, including when 50 requests arrive at once.
- A profile cannot book the same class twice.
- A Kids profile cannot book a 4th class in one Monday-to-Sunday week, or a 13th in a cycle.
- A Group plan profile cannot book an Adult Training class.
- Every example in 7.6 passes as an automated test.
- A QR screenshot older than 90 seconds is refused online; an offline pass works only on its own day.
- Offline scans sync with no duplicates, even if the sync is repeated.
- An online class attendee is marked attended only through the class code or a coach mark.
- A UTR already used is refused.
- Every UPI link and QR contains the member code note and the exact plan amount.
- A UPI change by an admin alerts the owner and is not live for 15 minutes unless the owner confirms.
- A coach calling Members, Payments or Settings endpoints directly gets "forbidden".
- A coach never sees a full phone number or any amount.
- Reversing a queued payment re-chains later periods with no gap.
- A studio-cancelled class returns credits and gives make-up credits.
- Jobs run twice in a row send no duplicate messages.
- Imported members show the right paid-until date and status on day one.
- The app installs on Android and iPhone, opens offline and shows the update prompt after a release.
- Lighthouse: PWA checks pass, accessibility 90 or above, performance 80 or above on mobile.

### 17.2 Test plan

| Level | What | Who |
| --- | --- | --- |
| Unit | Membership rules (7), credits, weekly caps, chain re-calculation, UPI link builder, token signing | Developer |
| API | Every permission row, every endpoint's validation, idempotency of jobs | Developer |
| Concurrency | 50 parallel bookings on one class; parallel verify of the same payment | Developer |
| End-to-end | The 8 flows in section 16 on staging | Developer, product lead |
| Device | Android low-end, Android mid, iPhone; camera, install, offline | Product lead |
| Pilot | 2 weeks on staging with 2 coaches, the admin and 15 to 20 real members, real classes, test UPI payments of ₹1 | Coaches, admin |
| Security | OWASP checklist, dependency audit, permission tests | Developer |
| Restore | Restore yesterday's backup to a fresh database and run smoke tests | Developer |

## 18. Delivery plan

One developer full-time, with the product lead and owner available for decisions. If a designer is not available, the developer uses the tokens in section 10 and a simple component set.

| Week | Work | Exit check |
| --- | --- | --- |
| 1 | Phase 0: decisions (section 5.2), repo, CI, environments, schema, logo SVG and icons, WhatsApp and DLT applications started | Staging live, open questions answered or defaults accepted |
| 2 | Accounts, login codes (email first), profiles, guardians, consent, roles and permission middleware | Permission tests green |
| 3 | Programs, plans, memberships and rules engine with all 7.6 tests; series, classes, closures | Rule tests green |
| 4 | Booking with concurrency, credits, cut-off, make-up credits; member Classes screen; messages and reminders job | Load test passes |
| 5 | QR tokens, scanner online and offline, class code, manual check-in, no-show job | Offline sync test passes |
| 6 | Payments: UPI settings with delay, per-member UPI link and QR, "I have paid", pending list, verify, receipts PDF, credit notes | Payment acceptance tests pass |
| 7 | Admin dashboard, member detail, staff management, leads and trials, daily summary; data import tool | Import dry run on staging |
| 8 | Website pages, legal pages, SEO, PWA polish, update prompt, accessibility pass | Lighthouse targets met |
| 9 | Pilot on staging with real staff and members; fix list; security review; restore test | Pilot sign-off by coaches and admin |
| 10 | Production import, go-live, staff training, launch support | Go-live checklist signed |
| 11–13 | After launch: waitlist, reports and CSV, statement matching (PAY-17), editable templates, push, milestones | Based on pilot feedback |

**Cut order if late:** push notifications, milestones, editable templates, statement matching, reports, waitlist, coach report. **Never cut:** entitlement rules, concurrency, QR security, offline scan queue, payment matching note, audit log, consent, backups and restore test, data import.

### 18.1 Definition of done (every requirement)

Code reviewed (self-review checklist if solo), tests written and passing, works on a phone at 360 px width in both themes, server-side permission check present, audit log entry where the requirement says so, PRD ID in the commit message, deployed to staging.

### 18.2 Go-live checklist

Domain and HTTPS; SPF, DKIM and DMARC passing; production secrets set; Ed25519 keys created; backups running and restore tested; staff two-step login on; owner account confirmed; UPI ID set and a ₹1 test payment verified end to end with receipt; legal pages live and reviewed; import checked by the admin; timetable series entered; error and uptime alerts reach the owner and developer; staff trained; rollback plan written (previous release and database snapshot).

## 19. Operations after launch

| When | Who | Task |
| --- | --- | --- |
| Daily, morning | Admin | Read the 9 am summary, verify pending payments, follow up leads |
| Before each class | Coach | Open the class once with signal so the roster is cached |
| After each class | Coach | Confirm attendance, especially online classes |
| Weekly | Admin | Check Due list, call members in grace, review no-shows |
| Monthly | Admin and accountant | Export receipts and credit notes; check against bank statement |
| Monthly | Developer | Dependency updates, backup restore spot check, review error log |
| Every 6 months | Developer | Rotate QR signing key, review staff accounts |
| On any incident | Developer, owner | Follow the breach or outage plan, write a short note of what happened |

Support: members contact the studio by WhatsApp. The admin handles account and payment questions; app bugs go to the developer through one shared list with a screenshot and the time it happened.

## 20. Risks

| Risk | Mitigation |
| --- | --- |
| Members change or delete the UPI note | Note pre-filled by the link, one-line instruction, UTR submission, statement matching (PAY-17) |
| Admin account takeover changes the UPI ID | Two-step login, re-authentication, owner alert and 15-minute delay, audit log |
| Payment checking still takes too long | Track the admin-time metric. **Trigger:** if it passes 30 minutes a day or 150 paying profiles, plan a UPI gateway with auto-confirmation |
| WhatsApp or DLT approval is slow | Email codes and messages at launch; WhatsApp switched on when approved |
| Weak signal in the studio | Offline roster, offline pass, queued scans, manual check-in |
| iPhone PWA limits | Codes not magic links, test camera early, install guide |
| Coaches do not adopt | Series so set-up is once a week, one-tap scanner, pilot with coaches first |
| Scope too big for one developer | Cut order, fixed Must list, change control |
| GST threshold crossed unnoticed | Monthly revenue on the dashboard, accountant review, BILL-3 ready |
| Child safety or data complaint | Kids rules (8.2), parental consent, lawyer-reviewed documents, named privacy contact |
| Single developer unavailable | Documented setup, README, runbook for deploy and restore, managed services where possible |

## 21. Appendix

### 21.1 Decision log

| Date | Decision | By |
| --- | --- | --- |
| v1.0 | Manual UPI, PWA, three roles | Product lead |
| v2.1 | Dark logo, plans and prices, kids via parents, stack, receipts without GST | Owner |
| v2.1 | Signed QR, audit log, consent, offline scans, 8–10 week plan | Product lead |
| v3.0 | Account and profile model, programs and entitlements, credits with weekly cap | Product lead, owner to confirm |
| v3.0 | Per-member UPI note and generated QR, 15-minute UPI change delay | Product lead, owner to confirm |
| v3.0 | Class code for online check-in, offline signed tokens | Product lead |
| v3.0 | Series, make-up credits, closures, leads and trials, data import moved into launch scope | Product lead, owner to confirm |

### 21.2 Change request template

| Field | Content |
| --- | --- |
| Title | Short name |
| Requested by | Name and role |
| Problem | What goes wrong today |
| Proposed change | Which requirement IDs change or are added |
| Impact | Weeks added, what moves out, cost |
| Decision | Accepted, rejected or later, by whom and when |

### 21.3 Change log

| Version | Summary |
| --- | --- |
| 1.0 | First PRD from prototype |
| 2.1 | Production review, owner answers, kids, receipts, stack |
| 3.0 | Closes the 25 gaps in section 1; adds team plan, benchmark, migration, leads, entitlements, online attendance and payment matching |
