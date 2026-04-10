import Link from "next/link";
import { FoodImage } from "@/components/FoodImage";
import {
  getTonightMeal,
  listPlans,
  listShopping,
  listUpcomingMeals,
  listFavourites,
  listPantry,
  listHistory,
  listMealsForPlan,
} from "@/lib/repo";
import { planDisplayName, type Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRecipe(json: string | null): Recipe | null {
  if (!json) return null;
  try { return JSON.parse(json) as Recipe; } catch { return null; }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric" });
}



export default async function HomePage() {
  const [tonight, activePlans, shopping, upcoming, favs, pantry, history, allPlans] =
    await Promise.all([
      getTonightMeal(),
      listPlans("active"),
      listShopping(),
      listUpcomingMeals(8),
      listFavourites(),
      listPantry(),
      listHistory(),
      listPlans(),
    ]);
  const tonightRecipe = parseRecipe(tonight?.recipe_json ?? null);
  const shoppingTotal = shopping.length;
  const shoppingTicked = shopping.filter((s) => s.ticked).length;
  const favCount = favs.length;
  const pantryCount = pantry.length;
  const historyCount = history.length;
  const allPlansCount = allPlans.length;

  // For each active plan, compute "X of Y meals left"
  const planSummaries = await Promise.all(
    activePlans.map(async (p) => {
      const meals = await listMealsForPlan(p.id);
      const total = meals.length;
      const cooked = meals.filter((m) => m.status === "cooked").length;
      const left = total - cooked;
      const last = meals[meals.length - 1];
      return { plan: p, total, cooked, left, lastDate: last?.scheduled_date };
    }),
  );

  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <p className="num">{today}</p>
      <h1 className="font-display text-4xl mt-1 mb-8 lg:text-5xl">Good evening</h1>

      <div className="desktop-grid">
        {/* TONIGHT */}
        <div className="ga-tonight">
          <p className="num mb-2">Tonight&apos;s dinner</p>
          {tonight && tonightRecipe ? (
            <div className="card overflow-hidden mb-6">
              <FoodImage title={tonightRecipe.title} height={200} />
              <div className="p-5">
                <p className="text-xs text-stone-500 mb-1">
                  {tonight.plan_name ? tonight.plan_name : "From plan"} · {fmtDate(tonight.scheduled_date)}
                </p>
                <h2 className="font-display text-2xl leading-tight mb-2">{tonightRecipe.title}</h2>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="pill">⏱ {tonightRecipe.total_minutes} min</span>
                  <span className="pill">{tonightRecipe.cuisine}</span>
                </div>
                <Link href={`/meals/${tonight.id}`} className="btn-primary w-full">Open recipe →</Link>
              </div>
            </div>
          ) : (
            <div className="card p-6 mb-6 text-center">
              <p className="text-stone-500 text-sm mb-3">Nothing planned for tonight.</p>
              <Link href="/plans/new" className="btn-primary inline-flex">Start a plan</Link>
            </div>
          )}
        </div>

        {/* SHOPPING SUMMARY */}
        <div className="ga-shopping">
          <p className="num mb-2">Shopping list</p>
          <Link href="/shopping" className="card block p-4 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg">{shoppingTotal} items to buy</p>
                <p className="text-xs text-stone-500">
                  Across {activePlans.length} active plan{activePlans.length === 1 ? "" : "s"} · {shoppingTicked} ticked
                </p>
              </div>
              <span className="text-stone-300 text-xl">›</span>
            </div>
          </Link>
        </div>

        {/* ACTIVE PLANS */}
        <div className="ga-plans">
          <div className="flex items-center justify-between mb-3">
            <p className="num">Active plans · {activePlans.length}</p>
            <Link href="/plans" className="text-xs text-stone-500">View all →</Link>
          </div>
          <div className="card mb-6">
            {planSummaries.length === 0 && (
              <p className="text-sm text-stone-500 p-4">No active plans yet.</p>
            )}
            {planSummaries.map(({ plan, total, cooked, left, lastDate }) => (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="plan-row">
                <div className="flex-1">
                  <p className="font-display text-base">{planDisplayName(plan)}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {left > 0 ? `${left} of ${total} meals left` : `${total} meals planned`}
                    {lastDate && ` · ${fmtDate(lastDate)} last`}
                  </p>
                  <div className="progress"><div className="progress-bar" style={{ width: `${total ? (cooked / total) * 100 : 0}%` }} /></div>
                </div>
                <span className="text-stone-300">›</span>
              </Link>
            ))}
          </div>
        </div>

        {/* UPCOMING CAROUSEL */}
        <div className="ga-upcoming">
          <div className="flex items-center justify-between mb-3">
            <p className="num">Upcoming meals · {upcoming.length}</p>
            <Link href="/plans" className="text-xs text-stone-500">View all →</Link>
          </div>
          <div className="upcoming-scroll">
            {upcoming.map((m) => {
              const r = parseRecipe(m.recipe_json);
              return (
                <Link key={m.id} href={`/meals/${m.id}`} className="card overflow-hidden block flex-shrink-0" style={{ width: 200, scrollSnapAlign: "start" }}>
                  <FoodImage title={r?.title ?? "Recipe"} height={110} />
                  <div className="p-3">
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                      {fmtDate(m.scheduled_date)} · {m.plan_name ?? "Plan"}
                    </p>
                    <h3 className="font-display text-sm leading-tight mt-1">
                      {r?.title ?? "Recipe pending"}
                    </h3>
                    {r && (
                      <div className="mt-1.5"><span className="pill" style={{ fontSize: ".6rem" }}>⏱ {r.total_minutes} min</span></div>
                    )}
                  </div>
                </Link>
              );
            })}
            {upcoming.length === 0 && <p className="text-sm text-stone-500">No upcoming meals.</p>}
          </div>
        </div>

        {/* QUICK ACCESS */}
        <div className="ga-quick">
          <p className="num mb-3">Quick access</p>
          <div className="grid grid-cols-2 gap-3 quick-grid">
            <Link href="/favourites" className="nav-tile">
              <p className="text-xs text-stone-500">Saved</p>
              <p className="font-display text-lg mt-1">Favourites · {favCount}</p>
            </Link>
            <Link href="/pantry" className="nav-tile">
              <p className="text-xs text-stone-500">Inventory</p>
              <p className="font-display text-lg mt-1">My pantry · {pantryCount}</p>
            </Link>
            <Link href="/history" className="nav-tile">
              <p className="text-xs text-stone-500">Cooked</p>
              <p className="font-display text-lg mt-1">History · {historyCount}</p>
            </Link>
            <Link href="/plans" className="nav-tile">
              <p className="text-xs text-stone-500">Archived</p>
              <p className="font-display text-lg mt-1">All plans · {allPlansCount}</p>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .desktop-grid { display: block; }
        .ga-plans .plan-row { display: flex; align-items: center; gap: .85rem; padding: .85rem 1rem; border-bottom: 1px solid #ECE6DC; text-decoration: none; color: inherit; }
        .ga-plans .plan-row:last-child { border-bottom: none; }
        .progress { height: 6px; background: #F1ECE2; border-radius: 9999px; overflow: hidden; margin-top: .4rem; }
        .progress-bar { height: 100%; background: #4A6B4A; border-radius: 9999px; }
        .nav-tile { background: #fff; border: 1px solid #ECE6DC; border-radius: 16px; padding: 1rem; text-align: left; display: block; text-decoration: none; color: inherit; }
        .upcoming-scroll { display: flex; gap: .75rem; overflow-x: auto; padding-bottom: .75rem; scroll-snap-type: x mandatory; margin: 0 -1.25rem; padding-left: 1.25rem; padding-right: 1.25rem; }
        @media (min-width: 1024px) {
          .desktop-grid {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 1.75rem;
            max-width: 1200px;
            grid-template-areas: "tonight shopping" "tonight plans" "upcoming upcoming" "quick quick";
          }
          .ga-tonight { grid-area: tonight; }
          .ga-shopping { grid-area: shopping; }
          .ga-plans { grid-area: plans; margin-bottom: 0 !important; }
          .ga-upcoming { grid-area: upcoming; }
          .ga-quick { grid-area: quick; }
          .upcoming-scroll { margin: 0; padding-left: 0; padding-right: 0; }
          .quick-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
