# Meal Planner — Handoff Notes

## What This Is
Personal meal planner web app for Josh Landy (family of 3: 2 adults, 1 kid). Replaces Marley Spoon. Paste butcher/grocer orders → pick nights → Claude generates recipes using your delivery + pantry → shopping list of what's missing.

## Tech Stack
- **Framework**: Next.js 16.2.2 (App Router, server components, route handlers)
- **Language**: TypeScript strict, `@/*` path alias
- **Styling**: Tailwind CSS v4 with `@theme` tokens
- **DB**: Turso (libSQL) via `@libsql/client`, with `file://` fallback for local dev
- **AI**: Anthropic Claude API (recipe generation via tool_use)
- **Deploy**: Vercel (auto-deploys from GitHub `JJLanJJ/meal-planner` on push to `main`)
- **PWA**: `app/manifest.ts` + `/public/icon.svg`

## Key Files
- `db/index.ts` — DB client init, schema apply (uses inlined `db/schema.ts`)
- `db/schema.ts` — Inlined SQL (source of truth, also in `db/schema.sql`)
- `lib/repo.ts` — All async DB operations (plans, meals, pantry, shopping, favourites, inventory)
- `lib/prompts.ts` — System prompt, user prompt builder, tool schema for Claude
- `lib/types.ts` — Zod schemas (Recipe, DeliveryItem, etc.), DB row types, qty parsing utils
- `lib/claude.ts` — Anthropic SDK client singleton
- `lib/parse-order.ts` — Regex parser for pasted order emails
- `lib/food-suggestions.ts` — 250+ food items with categories for pantry autocomplete
- `app/page.tsx` — Home dashboard (tonight's meal, upcoming, plans, quick access)
- `app/plans/new/page.tsx` — 3-step plan creation wizard (delivery → calendar → generate)
- `app/plans/[id]/page.tsx` — Plan detail with meal list, inventory section, delete button
- `app/plans/[id]/Inventory.tsx` — Client component: inventory list, add items, regenerate remaining
- `app/plans/[id]/DeletePlan.tsx` — Client component for plan deletion
- `app/meals/[id]/page.tsx` — Recipe card (ingredients, method, equipment, mark cooked, favourite)
- `app/meals/[id]/MealActions.tsx` — Client component for cooked/favourite buttons
- `app/shopping/page.tsx` — Shopping list (client component, checkbox toggle)
- `app/pantry/page.tsx` — Pantry manager with autocomplete, auto-categorise, inline qty editing
- `app/favourites/page.tsx` — Saved recipes grid
- `app/history/page.tsx` — Cooked meals history
- `components/FoodImage.tsx` — Cuisine-based gradient cards with optional Pexels photo upgrade
- `app/api/food-image/route.ts` — GET serves cached images from Turso
- `app/api/food-image/cache/route.ts` — POST fetches from Pexels and caches (needs PEXELS_API_KEY)
- `app/api/parse-file/route.ts` — Upload image/PDF of order → Claude vision extracts items
- `app/api/suggest/route.ts` — Recipe generation via Claude tool_use (supports planId for inventory-aware generation)
- `app/api/plans/[id]/inventory/route.ts` — GET/POST/PATCH for plan inventory management
- `app/api/plans/[id]/regenerate/route.ts` — POST regenerates uncooked meals using current inventory

## Environment Variables (in `.env.local` and Vercel)
- `ANTHROPIC_API_KEY` — Live, working
- `TURSO_DATABASE_URL` — `libsql://meal-planner-jjlanjj.aws-ap-south-1.turso.io`
- `TURSO_AUTH_TOKEN` — Set
- `PEXELS_API_KEY` — Optional; if set, food photos are fetched from Pexels and cached. Without it, cuisine-based gradient cards are shown (which look fine).
- `GEMINI_API_KEY` — Set but unused (image gen needs paid plan)

## What's Working
1. ✅ Full 3-step plan creation: paste orders → pick nights with cuisine/time/difficulty prefs → Claude generates recipes
2. ✅ Recipe detail pages with ingredients (colour-coded by source), method steps, child notes, equipment list
3. ✅ Shopping list auto-syncs "to-buy" items when meals are created
4. ✅ Pantry management with autocomplete (250+ foods), auto-categorisation, and optional qty per item
5. ✅ Mark meals cooked / save to favourites
6. ✅ Plan deletion with confirmation
7. ✅ "Swap this meal" button regenerates a single recipe
8. ✅ Upload receipt/invoice (image or PDF) for order parsing via Claude vision
9. ✅ "Other" order source (third textarea alongside Butcher and Grocer)
10. ✅ Desktop-responsive layouts on all pages
11. ✅ PWA manifest
12. ✅ Deployed to Vercel, auto-deploys from GitHub
13. ✅ **Inventory tracking** — combined delivery + pantry inventory per plan, quantities deduct as meals are saved
14. ✅ **Arrival dates** — each delivery source gets an "arriving" date; Claude only uses items available by each cooking night
15. ✅ **Add items to existing plan** — "Add items to inventory" on plan detail page with arrival date
16. ✅ **Regenerate remaining meals** — refunds old deductions, re-plans uncooked nights with current inventory
17. ✅ **Food images** — cuisine-based gradient cards (Italian=reds, Thai=greens, etc.) with emoji + title. Optionally upgrades to Pexels photos if API key is set.

## How Inventory Works
- **Plan created** → `inventory_items` table populated from delivery items (with `available_from` dates) + pantry items
- **Meal saved** → delivery ingredients deducted from inventory (e.g. 750g chicken - 400g used = 350g remaining)
- **Item fully consumed** → deleted from inventory
- **Qty blank** → item is "available" (unlimited, like pantry staples); manually delete to remove
- **Arrival dates** → items with `available_from` in the future are dimmed in the UI and excluded from Claude's prompt for earlier nights
- **Add items mid-plan** → paste a new delivery, set arrival date, items added to inventory
- **Regenerate** → refunds old uncooked recipe deductions, calls Claude with current inventory, saves new recipes, re-deducts
- **Qty parsing** → `parseQty()` / `formatQty()` in `lib/types.ts` handle "750g", "500ml", "2 pcs" etc.

## How Food Images Work
- `FoodImage.tsx` checks `/api/food-image?title=...` (cache in Turso) first
- If no cache hit and `PEXELS_API_KEY` is set, searches Pexels in the background and caches the result
- If no API key or no result, shows a styled gradient card based on cuisine type with food emoji + title overlay
- Gradient themes: Italian=warm reds, Thai=greens, Mexican=terracotta, BBQ=smoky browns, etc.

## Database Schema (6 tables + 1 new)
- `plans` — master plan record with `delivery_json` (original order text for reference)
- `meals` — individual meals within a plan, `recipe_json` stores the full recipe
- `pantry_items` — pantry staples with optional `qty` column
- `shopping_items` — dynamic shopping list, auto-synced from "to-buy" recipe ingredients
- `favourites` — saved recipes
- `food_images` — cached food photos (title → base64 image data)
- `inventory_items` — per-plan inventory: `name`, `qty`, `source` (delivery/pantry), `category`, `available_from`

## Recent Commits (latest first)
- `046d4ac` — Add arrival dates, top-up inventory, and regenerate remaining meals
- `1892597` — Upgrade pantry — autocomplete, auto-categorise, optional qty per item
- `da6db02` — Fix food images — cuisine-based gradient cards, optional Pexels upgrade
- `0ea5551` — Add inventory tracking — combined delivery + pantry with quantity deduction
- `a8f4111` — Add time/difficulty/cuisine preferences per meal night, add equipment to recipes
- `e340f5a` — Load images directly from Pollinations in browser, cache in background
- `30eafc4` — Proxy food images server-side with Turso caching
- `1e5ae12` — Switch to Gemini Imagen (didn't work on free tier)
- `ceb7a2f` — FoodImage component with retry/fallback
- `6ba2ff8` — Show cuisine instead of 'Planned', add delete plan button
- `a0342de` — Fix shopping sync on meal create, prevent duplicate plan saves, AI food images
- `f3b8d12` — Add file upload + 'Other' source to delivery, rename to 'Upcoming delivery'
- `5603e84` — Initial commit

## Gotchas
- `db/index.ts` uses inlined schema from `db/schema.ts` (NOT filesystem read) — this was needed because `process.cwd()` on Vercel doesn't match project root
- `.env.local` contains live API keys — **never commit this file** (.gitignore already excludes it)
- `app/api/suggest/route.ts` uses Anthropic SDK; `app/api/parse-file/route.ts` uses fetch directly — per user's rule: "use fetch over SDKs in serverless"
- The favourite POST sends `JSON.stringify(recipe)` directly (not wrapped in `{recipe}`) since the route validates with `RecipeSchema.safeParse`
- User's feedback rule: "Don't ask permission for repetitive mapping/data entry tasks, just do them"
- Project lives at `/Users/quro/code/meal-planner` (was moved from `~/Documents/Claude/meal-planner` due to macOS sandbox restrictions)
- `.claude/launch.json` at `/Users/quro/Documents/Claude/.claude/launch.json` points to the project for preview server
- Schema changes require updating BOTH `db/schema.sql` AND `db/schema.ts` (inlined copy)
- Turso applies schema on first connection — new columns/tables are auto-created via `CREATE TABLE IF NOT EXISTS`
