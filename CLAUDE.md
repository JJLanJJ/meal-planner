@AGENTS.md

# Meal Planner

Personal weekly meal planner for Josh's family of 3 (2 adults + 1 child). Replaces a Marley Spoon subscription. Josh gets weekly butcher and grocer deliveries; this app turns those into a week of Marley-Spoon-style recipe cards.

## Core flow
1. **New plan** — paste butcher/grocer order emails (mobile copy-paste). Parser extracts ingredients, ignores noise (curated boxes, knife offers, etc.).
2. **Calendar** — pick which nights to cook this stretch (1–30 nights), optionally tag each with a cuisine (preset or free text).
3. **Ideas** — Claude generates one recipe per cooking night, respecting the delivery, the pantry, the calendar, and recent history (don't repeat).
4. **Recipe card** — Marley Spoon style: hero photo, time/serves pills, ingredient list colour-coded by source (delivery / pantry / to-buy), numbered steps, child-portion notes, "mark as cooked" CTA.
5. **Cook** — through the week. Mark cooked → moves to history.

## Architecture: overlapping plans

Plans are **additive**. A new delivery spawns a new plan alongside any in-progress ones. Multiple plans can be active simultaneously. Plans have an optional custom name (defaults to `Plan from {date}`).

Two layers:

**Transient — scoped to a Plan:**
- Plan (name, created date, adults, kids, status: active/archived, star rating 1–5 set on archive, optional notes)
- Meal (belongs to Plan, scheduled date, cuisine pref, recipe JSON, status: planned/cooked/skipped)

**Persistent — global, reconciled across plans:**
- **Pantry** — staples Josh always has (oils, spices, sauces, aromatics, dry goods). Categorised. Used by the meal generator as available ingredients.
- **Shopping list** — derived: union of `to-buy` items across all active plans. Shows provenance (which plan/meal each item is for). Plus user-added items. Tickable.
- **Favourites** — saved recipes (heart icon on recipe card). Independent of any plan.
- **History** — every cooked meal, with date and link back to its plan. Filterable by plan rating, cuisine, protein. Star-rating from the parent plan inherits onto history rows for filtering.

Plans are archived **manually**. On archive, prompt for 1–5 star rating + optional notes — used to filter history and tune future suggestions.

## Screens (see `mockups/` for the locked visual spec)
- `00-home.html` — dashboard: tonight's dinner, shopping summary, active plans, upcoming meals carousel, quick access. Sidebar nav (collapsed icon-rail on desktop, hamburger drawer on mobile).
- `01-ingredients.html` — Step 1: plan name (optional), adults/kids stepper, butcher paste, grocer paste.
- `07-calendar.html` — Step 2: month grid date picker + per-date cuisine (preset or free text).
- `02-suggestions.html` — Step 3: generated meal cards with delivery/pantry/to-buy pills, regenerate per-card.
- `03-recipe.html` — Step 4: full recipe card.
- `04-shopping.html` — master list across all active plans.
- `05-favourites.html` — saved meals, "cook again" shortcut.
- `06-pantry.html` — categorised inventory editor.
- `08-history.html` — every cooked meal, search + rating/cuisine/protein filters.
- `09-plans.html` — active & archived plans, manual archive with rating modal, rename buttons.

## Design tokens
- **Cream** background `#FAF7F2`
- **Charcoal** text `#1F1B16`
- **Sage** primary/accent `#4A6B4A`
- **Terracotta** badges/to-buy `#C65A3A` and `#D9803A`
- **Tan** borders/photos `#B8A582` / `#ECE6DC`
- **Fonts** — Fraunces (display, serif) + Inter (body)
- **Mobile-first**, breakpoint at `1024px` for desktop sidebar layout

## Conventions
- All paste-and-parse inputs assume the user is on mobile, copying from email.
- Parser is regex-first with an Anthropic fallback for messy input (don't hit the API for the obvious case).
- Pantry staples are pre-seeded with sensible defaults; user trims them.
- Never discard user data on errors — surface integration errors loudly, don't swallow.
- "Mark as cooked" is the only path that moves a meal into history. Don't auto-complete based on dates.

## Tech
- **Next.js 16.2.2** — read `node_modules/next/dist/docs/` before writing route handlers; APIs differ from older Next versions.
- **TypeScript**, **Tailwind v4**, **Anthropic SDK**, **Zod** for schema validation.
- **DB**: starts on `better-sqlite3` for local dev; migrates to **Turso** (libSQL) for Vercel deploy. Schema lives in `db/schema.sql`.
- **Deploy target**: Vercel + Turso. PWA add-to-home-screen on phone.

## Out of scope (for now)
- Multi-user / auth — single user, single household.
- Sharing recipes externally.
- Nutrition tracking.
- Grocery delivery integration (Josh orders manually).
