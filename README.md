# CUAgain

**Lost Something? Find It Again.**
A web-based lost-and-found platform for Capitol University students.

Current build: **Phase 2 (Landing page and authentication)**, on top of the Phase 1 foundation and design system.

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

Until then, registration still checks that the email prefix matches the student ID, but accepts any domain. Because this check runs in the browser, also enforce the domain on the server in Phase 3 (a database trigger or auth hook), otherwise it can be bypassed.

## Security notes

- The browser only ever uses the publishable key. `.env.local` is git-ignored.
- A user's role is **never** taken from sign-up data. In Phase 3, roles are assigned only on the server, so nobody can make themselves an admin.
- Registering an email that already exists looks the same as a new registration, and password reset always says "if an account exists", so the forms never reveal who has an account.
- Raw server errors are never shown. Each one is mapped to a short, safe message.
- The email address on the "check your email" page is passed in router state, not in the URL.
- `ProtectedRoute` only controls what the screen shows. Real protection comes from Row Level Security in Phase 3.
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
  context/        AuthProvider (keeps the signed-in session in sync)
  services/       supabaseClient, authService (every sign-in, sign-up and reset call)
  pages/
    landing/      HomePage and its sections
    auth/         Login, Register, VerifyEmail, ForgotPassword, ResetPassword, TermsDialog
    portal/       PortalPage (placeholder)
    design-system/
  hooks/          useAuth, useCooldown, useAuthLinkError, useCssVariableValue
  utils/          authSchemas, routes, redirect, categories, formatDate ...
supabase/
  migrations/     SQL migrations (Phase 3)
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

## Before Phase 3

- Confirm the approved school email domain with the university.
- Connect Supabase (above) and run the full loop once.
- Phase 3 adds the database: the `profiles` table that receives the sign-up data, roles, and Row Level Security.
