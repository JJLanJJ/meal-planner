# Build plan

Phases. Each one ends in a state Josh can see.

## Phase 1 — Audit & schema
1. Read existing `app/`, `components/`, `db/`, `lib/` — figure out what's salvageable from the pre-v2 scaffold and what gets deleted.
2. Lock the schema in `db/schema.sql`:
   - `plans` (id, name, created_at, adults, kids, status, rating, notes, archived_at)
   - `meals` (id, plan_id, scheduled_date, cuisine_pref, recipe_json, status, cooked_at)
   - `pantry_items` (id, name, category)
   - `shopping_items` (id, name, qty, source_meal_id NULL, ticked, added_by_user)
   - `favourites` (id, recipe_json, saved_at)
   - `history` (derived view over `meals` where status='cooked', joined to plans for rating)
3. Migration runner — `db/index.ts` reads schema, applies once on boot.

**Done when:** `npm run dev` boots, DB file exists with all tables, no UI yet.

## Phase 2 — Parser + pantry seed
4. `lib/parse-order.ts` — regex-first parser for Butcher Crowd format (proven against Josh's real receipt). Grocer parser uses same shape.
5. Anthropic fallback only when regex finds <2 items.
6. Seed `pantry_items` with `lib/pantry-staples.ts` defaults on first boot.

**Done when:** unit test (or curl) parses Josh's pasted butcher email into a clean ingredient array.

## Phase 3 — Suggestion engine
7. `lib/prompts.ts` — system prompt for the meal generator. Inputs: delivery items, pantry, calendar (dates + cuisines), recent history (last 30 days, exclude these), adults/kids.
8. `app/api/suggest/route.ts` — POST handler that calls Claude with structured output (Zod schema for the recipe array).
9. Recipe schema: title, description, time, prep, cook, difficulty, ingredients[{name, qty, source: delivery|pantry|to-buy}], steps[{minutes, instruction, child_note?}].

**Done when:** posting a parsed delivery + 5 dates returns 5 valid recipes in JSON.

## Phase 4 — Port mockups to React
10. Shared layout with the sidebar shell (collapsed icon-rail desktop, hamburger drawer mobile) — extract from `mockups/00-home.html`.
11. Port screens, wired to real data:
    - `app/page.tsx` — Home dashboard
    - `app/plan/new/ingredients` — Step 1
    - `app/plan/new/calendar` — Step 2
    - `app/plan/new/suggestions` — Step 3
    - `app/plan/[id]/meals/[mealId]` — Recipe card
    - `app/shopping`, `app/pantry`, `app/favourites`, `app/history`, `app/plans`
12. End-to-end: paste delivery → name plan → pick dates → generate → cook → mark cooked → see in history.

**Done when:** Josh runs the full flow on `localhost:3000` and signs off.

## Phase 5 — Deploy
13. Swap `better-sqlite3` for `@libsql/client`. Schema is identical, queries barely change.
14. Set up Turso DB, get connection string.
15. **Pause for Josh's go.** Push to `JJLanJJ/meal-planner`.
16. **Pause again.** Import to Vercel, set env: `ANTHROPIC_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
17. Add to Home Screen on Josh's phone (PWA manifest in `app/manifest.ts`).

**Done when:** Josh opens the app from his home screen, pastes a real delivery, cooks from it.

## Out of scope (cut for MVP, revisit later)
- Photos on recipe cards (placeholder gradients are fine).
- Multi-user / auth.
- Push notifications ("tonight's dinner" reminder).
- Nutrition data.
- Sharing/exporting recipes.
- Apple Health / fitness integration.

## Risk register
- **Next.js 16 breaking changes** — APIs differ from training data. Always check `node_modules/next/dist/docs/` before writing route handlers, server actions, metadata.
- **better-sqlite3 → libSQL swap** — should be near-drop-in but the sync API differs. Test the swap on a branch before deploying.
- **Anthropic JSON parsing** — use tool-use / structured output, not regex on prose. Validate with Zod.
- **Vercel filesystem is read-only** — no SQLite file writes in production. This is why we move to Turso before deploying.
