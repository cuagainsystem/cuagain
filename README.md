# CUAgain

**Lost Something? Find It Again.**
A web-based lost-and-found platform for Capitol University students.

This is the **Phase 1 (Foundation)** build: project setup, routing, shared layout, design system and reusable components. No backend is connected yet.

## Run it

```bash
npm install
npm run dev
```

Then open the address shown in the terminal (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Check the code for problems |

## Pages

| Route | Page |
| --- | --- |
| `/` | Placeholder home page with the build-status list (replaced in Phase 2) |
| `/design-system` | Living documentation of every token and component |
| anything else | 404 page |

## Design tokens

All tokens live in `src/styles/tokens.css`. Components read these variables and never hard-code colours or sizes. The `/design-system` page reads the live values, so it always matches.

| Token | Value | Usage |
| --- | --- | --- |
| `--color-primary` | `#B5122A` | Brand, primary buttons, key actions |
| `--color-surface` | `#FFFFFF` | Cards and surfaces |
| `--color-bg` | `#F5F5F7` | Main app background |
| `--color-text` | `#30323A` | Headings and body text |
| `--color-text-muted` | `#626873` | Supporting labels and metadata |

Fonts: **Fraunces** (headings) and **Manrope** (interface and body), loaded from Google Fonts in `index.html`.

Design rules for this project:

- No emojis. Use Lucide icons.
- The logo is a placeholder (`LogoPlaceholder`). Swap it when the real logo is ready.
- Capitol red is used sparingly. White and soft grey carry most of the interface.

## Project structure

```
src/
  components/
    common/       Button, ButtonLink, Badge, StatusBadge, ReportTypeBadge, Dialog, LogoPlaceholder
    forms/        TextField, TextAreaField, SelectField (share FieldShell)
    cards/        ItemCard
    navigation/   AppLayout, Navbar, Footer
  pages/
    landing/      HomePage
    design-system/
    auth/ dashboard/ browse/ reports/ claims/ chat/ messages/ profile/ admin/   (empty, filled in later phases)
  hooks/          useCssVariableValue
  services/       Database calls will live here (Phase 3+)
  types/          ItemReport, CategorySlug, BadgeTone
  utils/          routes, categories, formatDate, classNames, reportLabels
  styles/         tokens.css, base.css
supabase/
  migrations/     SQL migrations (Phase 3)
  functions/      Edge Functions (Phase 6)
```

## Phase 1 completion check

- [x] App starts locally
- [x] Git repository initialised
- [x] Shared layout renders (skip link, navbar, footer)
- [x] Design tokens documented (this file and `/design-system`)

## Before Phase 2

Confirm the exact approved school email domain with the university. The roadmap's example is `1234567@g.cu.edu.ph`, but do not enforce it in registration until it is confirmed.

## Secrets

Never commit `.env` files, Brevo API keys, database passwords or Supabase service-role keys. Copy `.env.example` to `.env.local` when Supabase is added in Phase 3.
