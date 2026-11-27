# CUAgain

**Lost Something? Find It Again.**
A web-based lost-and-found platform for Capitol University students.

Current build: **Phase 3 (Database and user management)**, on top of Phase 2 (landing page and authentication) and Phase 1 (foundation and design system).

## Run it

```bash
npm install
cp .env.example .env.local      # then fill it in, see "Connect Supabase" below
npm run dev
```

Open the address shown in the terminal (usually http://localhost:5173). The landing page works without any setup. The account pages show a yellow notice until Supabase is connected.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Check the code for problems |
| `npm run test:db` | Build a scratch local Postgres database and run the access-control tests (needs PostgreSQL installed) |

## Connect Supabase (one-time, about 10 minutes)

1. Create a project at supabase.com. In **Project Settings, API**, copy the project URL and the **publishable** (anon) key into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```
   Never use the service-role key here. Restart `npm run dev` after editing `.env.local`.
2. **Authentication, URL Configuration**
   - Site URL: `http://localhost:5173`
   - Redirect URLs: add `http://localhost:5173/login` and `http://localhost:5173/reset-password`
   - When you deploy, add the same two paths on your real domain.
3. **Authentication, Sign In / Providers, Email**
   - Turn **Confirm email** on. Users cannot sign in until they verify.
   - Set the password rules to match the app: minimum length 8, and require lowercase, uppercase and digits.
4. **Email sending.** Supabase's built-in email is fine for testing but heavily rate-limited. For real use, add Brevo's SMTP details under **Authentication, SMTP Settings**, as the roadmap plans.

The school email domain is a separate setting, see "Email domain" below.

## What works in Phase 2

| Route | Page |
| --- | --- |
| `/` | Landing page: hero, purpose and benefits, how it works, report guidelines, claiming, FAQs |
| `/register` | Create an account (username, student ID, school email, user type, password, terms) |
| `/verify-email` | "Check your email" with a resend button (60 second cooldown) |
| `/login` | Sign in, with resend for unverified accounts |
| `/forgot-password` | Request a reset link |
| `/reset-password` | Choose a new password from the emailed link |
| `/portal` | Signed-in placeholder (signed-out visitors are sent to `/login` and brought back after) |
| `/design-system` | Living documentation of every token and component, plus roadmap progress |

The navbar's **Student Web Portal** button goes to `/login` when signed out and to `/portal` when signed in.

## Registration rules (from the roadmap)

| Field | Rule |
| --- | --- |
| Username | 3 to 20 characters: letters, numbers, dots, underscores |
| Student ID | Exactly 7 digits |
| School email | Valid email, and the part before the `@` must equal the student ID |
| User type | Student, Staff or Teacher |
| Password | 8 to 72 characters with a lowercase letter, an uppercase letter and a number |
| Terms | Must be accepted |

All rules live in `src/utils/authSchemas.ts`. Browser checks are for usability only. Supabase Auth enforces the real security.

### Email domain

The roadmap says to **confirm the exact approved domain with the university before enforcing it**. So the domain is a setting, not hard-coded. Once confirmed, set it in `.env.local`:

```
VITE_SCHOOL_EMAIL_DOMAIN=g.cu.edu.ph
```

Until then, registration still checks that the email prefix matches the student ID, but accepts any domain. Since Phase 3 the database enforces the domain too, see "Email domain, server side" below.

## Security notes

- The browser only ever uses the publishable key. `.env.local` is git-ignored.
- A user's role is **never** taken from sign-up data. Roles are assigned only by the database, so nobody can make themselves an admin.
- Registering an email that already exists looks the same as a new registration, and password reset always says "if an account exists", so the forms never reveal who has an account.
- Raw server errors are never shown. Each one is mapped to a short, safe message.
- The email address on the "check your email" page is passed in router state, not in the URL.
- `ProtectedRoute` only controls what the screen shows. Real protection comes from Row Level Security (Phase 3, below).
- The terms of use in `src/pages/auth/TermsDialog.tsx` are a **draft**. Have the school approve the final wording before real users sign up.

## Design rules

- No emojis. Use Lucide icons.
- The logo is a placeholder (`LogoPlaceholder`). Swap it when the real logo is ready.
- Capitol red is used sparingly. White and soft grey carry most of the interface.
- Tokens live in `src/styles/tokens.css`. Components read those variables and never hard-code colours or sizes.
- Fonts: **Fraunces** (headings) and **Manrope** (interface), loaded from Google Fonts in `index.html`.

## Project structure

```
src/
  components/
    common/       Button, ButtonLink, PortalButton, Badge, FormNotice, Dialog, PageLoader, LogoPlaceholder ...
    forms/        TextField, TextAreaField, SelectField, CheckboxField, PasswordRequirements
    auth/         AuthShell, ProtectedRoute, NotConfiguredNotice, shared form styles
    cards/        ItemCard
    navigation/   AppLayout, Navbar, Footer, ScrollToHash
  config/         env.ts (public settings read from .env.local)
  context/        AuthProvider (keeps the session and the user's profile and role in sync)
  services/       supabaseClient, authService (sign-in, sign-up, reset), profileService (profile and avatars)
  pages/
    landing/      HomePage and its sections
    auth/         Login, Register, VerifyEmail, ForgotPassword, ResetPassword, TermsDialog
    portal/       PortalPage (placeholder, shows the profile and role from the database)
    design-system/
  hooks/          useAuth, useCooldown, useAuthLinkError, useCssVariableValue
  utils/          authSchemas, routes, redirect, categories, formatDate ...
supabase/
  migrations/     SQL migrations 1 to 7 (Phase 3)
  tests/          harness.sql, rls_tests.sql, run.sh (access-control tests)
  functions/      Edge Functions (Phase 6)
```

## Phase 2 completion check

| Roadmap check | Status |
| --- | --- |
| Landing page sections and responsive layout | Done, checked at desktop and phone width |
| Registration, validation, terms | Done |
| Email verification and resend | Done in the app. Needs your Supabase project to send real emails |
| Login, logout, protected pages | Done |
| Forgot and reset password | Done in the app. Needs your Supabase project to send real emails |
| Works with real Supabase accounts | **Not yet verified.** See below |

I tested every flow in a real browser against a simulated Supabase API: validation messages, the exact data sent on sign-up, redirects, session restore on reload, resend, reset and sign-out. I could not test against a live Supabase project from here. After you connect yours, try the full loop once: register, open the verification email, sign in, sign out, reset the password.

## Phase 3: database and user management

Everything lives in `supabase/migrations`, in order. Nothing in the app needs to change when you apply them.

### Apply the migrations (about 5 minutes)

Easiest way, no tools needed:

1. Open your Supabase project, then **SQL Editor, New query**.
2. Open each file in `supabase/migrations`, in number order (`...000001` first, `...000007` last). Paste it in and click **Run**. Wait for "Success" before the next one.
3. Open **Table Editor**. You should see 19 tables, and each one shows "RLS enabled".

If you use the Supabase CLI instead: `supabase link`, then `supabase db push`.

Run them on a fresh project. They create everything from scratch and are not meant to be run twice.

### Make the first super admin (once)

There is deliberately no button or sign-up trick that creates an administrator. Do it by hand:

1. Register normally in the app and verify your email.
2. In the SQL Editor run (use your own 7-digit student ID):
   ```sql
   update public.profile_private set role = 'super_admin' where student_id = '1234567';
   ```
3. Sign out and in again. The portal now shows "Super administrator".

From then on a super admin promotes other people with the `set_user_role` function (the Phase 7 admin dashboard will have a screen for it).

### Set the school email domain (when the university confirms it)

```sql
update public.app_settings set value = 'g.cu.edu.ph' where key = 'allowed_email_domain';
```

While the value is empty any domain is accepted (the email must still start with the student ID). Also set `VITE_SCHOOL_EMAIL_DOMAIN` in `.env.local` so the form warns people before they submit.

### What the database stores

| Table | Holds | Who can see it |
| --- | --- | --- |
| `profiles` | Username, user type, avatar | Every signed-in user |
| `profile_private` | Student ID, email, role, account status | Only the owner and administrators |
| `avatars` | The avatar choices | Everyone signed in |
| `categories` | The 7 item categories | Everyone signed in |
| `reports` | Lost and found reports | Everyone, except hidden ones (owner and admins only) |
| `item_images` | Photo records (files go in Storage in Phase 4) | Public photos to everyone. ID photos only to the owner and admins |
| `claims` | Ownership claims | The claimant and administrators only |
| `claim_evidence` | Proof files for a claim | The claimant and administrators only |
| `message_requests`, `conversations`, `conversation_members`, `messages` | Private chat | The two people in the chat only. Not even administrators |
| `community_messages` | Community chat | Everyone signed in (admins can remove posts) |
| `notifications` | Alerts | Each user sees their own |
| `activity_logs`, `error_logs` | Audit trail and errors | Administrators read only. Nobody can edit or delete from the app |
| `watchlist` | Categories a user follows | Each user sees their own |
| `feedback` | Rating after a completed claim | The author and administrators |
| `app_settings` | Rules such as the email domain | Super admins only |

### How it stays secure, in plain English

- **Every table has Row Level Security.** With no rule, nobody can read or write a row. Each rule says who gets in.
- **Supabase opens new tables to everyone by default**, so every table first has all access removed and then gets back only what the app needs. Signed-out visitors can touch nothing.
- **Public and private data are in separate tables.** Row Level Security works on whole rows, so student IDs and emails live in `profile_private`, which other users cannot read at all.
- **Dangerous fields have no write access.** From the browser a user can change only their username and avatar. They cannot change their role, status, student ID, a report's status, or a claim's decision. Those happen only through database functions that first check who is calling.
- **The role comes from the user type they pick at registration, never from sign-up data.** A hacked sign-up request that includes `"role": "super_admin"` is ignored (this is tested).
- **Registration rules are enforced by the database**, not only the browser: username format, 7-digit student ID, email starts with the student ID, user type, no duplicates (usernames ignore upper/lower case), and the school domain once set. A sign-up that breaks a rule is refused as a whole.
- **Suspended accounts** can still sign in and read, but cannot post, report, claim, message or edit. (Cutting off sign-in completely needs a server function, planned for Phase 7.)
- **The last super admin cannot be removed**, so you cannot lock yourself out.
- **Role changes, suspensions and moderation are written to `activity_logs`** by the database itself, so they cannot be skipped or forged.
- **Claim rules:** only found items, not your own, not hidden, not already completed, one live claim per person per item, and only you and administrators see it. The person who found the item cannot see who claimed it or the evidence, so nobody can copy a claimant's proof.
- **Photos of IDs are always private**, even if the upload asks for public.

### Test it

`npm run test:db` builds a scratch database, applies all migrations and runs **210 checks**. Each one pretends to be a real user (signed out, student, staff, administrator, super admin, suspended) and tries both allowed actions and attacks: reading someone else's claim, promoting yourself to admin, forging a log entry, posting while suspended, and so on. Every attack must be refused. The script needs PostgreSQL 15 or newer on your computer. It never touches your Supabase project.

### Phase 3 completion check

| Roadmap check | Status |
| --- | --- |
| Profiles, roles and permission tables exist | Done (migrations 1 to 7) |
| Table access rules work as intended | Done, 210 automated checks pass on a local Postgres that imitates Supabase |
| Unauthorized queries are refused | Done, covered by the same checks |
| App reads the profile and role from the database | Done (`profileService`, `AuthProvider`, portal) |
| Works on your real Supabase project | **Not yet verified.** Apply the migrations, then register, check the portal shows your username and role, and try the super admin step above |

What is intentionally left for later phases: file storage rules (Phase 4, with the upload screens), the claim review actions approve, reject and complete (Phase 5), chat live updates (Phase 6), the admin screens and full sign-in blocking for suspended users (Phase 7).

## Phase 4: reports, photos, search and dashboard

Routes (all need sign-in):

| Route | What it is |
| --- | --- |
| `/portal` | Dashboard: quick actions, your numbers, newest found and lost items, claims and notifications |
| `/reports` | Browse and search every report |
| `/my-reports` | Your own reports |
| `/reports/new/lost`, `/reports/new/found` | Report forms |
| `/reports/:id` | Report detail (owners can edit or delete while the report is open) |
| `/reports/:id/edit` | Edit form |

How it works:

- **Search and filters** run in the database through the `search_reports` function (migration 8): type, category, location, date range, status, sort and paging. Filters live in the page address, so a search can be shared and the Back button behaves.
- **Photos** are prepared in the browser first: re-encoded as JPEG (this removes location data from the picture), at most 1600 px wide, 5 MB, 5 per report. The storage bucket `item-images` is private; pictures are shown with short-lived signed links. Photos of IDs and cards (restricted categories) are never visible to other users.
- **Reports can be changed only while open.** Once someone reviews a claim they are locked, enforced by the database and not only the screen.

Migration 8 (`storage_and_search`) is applied to your Supabase project (`lost and found systen`). Run `npm run test:db` to re-check the access rules (250 checks).

### Phase 4 completion check

| Item | Status |
| --- | --- |
| Report lost and found items with photos | Done |
| Browse, search, filter, sort, page | Done |
| Edit and delete own open reports | Done |
| Dashboard with live data | Done |
| Automated checks | 130 browser checks (Phase 4), 76 (Phase 2 and 3), 250 database checks, all passing against a simulated Supabase |
| Works end to end on your real project | **Not yet verified.** Create a report with a photo and confirm it appears in Browse |

Left for later: claiming an item (Phase 5), admin report controls (Phase 7), search by photo (Phase 8, the button is already there but disabled), and cleanup of orphaned photo files.

## Before Phase 5

- Try the Phase 4 checklist above on your real project.
- Confirm the approved school email domain with the university and set it.
