import Link from "next/link";
import { listPlans, listMealsForPlan } from "@/lib/repo";
import { planDisplayName, type Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRecipe(json: string | null): Recipe | null {
  if (!json) return null;
  try { return JSON.parse(json) as Recipe; } catch { return null; }
}

function fmtDay(iso: string): { d: string; w: string } {
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString("en-AU", { day: "numeric" }),
    w: dt.toLocaleDateString("en-AU", { weekday: "short" }),
  };
}

function fmtCreated(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showArchived = tab === "archived";

  const [active, archived] = await Promise.all([listPlans("active"), listPlans("archived")]);

  const plans = showArchived ? archived : active;
  const allMeals = await Promise.all(plans.map((p) => listMealsForPlan(p.id)));

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Plans</p>
      <h1 className="font-display text-4xl mt-1 mb-6">All plans</h1>

      <div className="flex gap-2 mb-5">
        <Link href="/plans" className={showArchived ? "btn-ghost" : "btn-primary"}>
          Active · {active.length}
        </Link>
        <Link href="/plans?tab=archived" className={showArchived ? "btn-primary" : "btn-ghost"}>
          Archived · {archived.length}
        </Link>
      </div>

      {plans.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-stone-500 text-sm mb-3">
            {showArchived ? "No archived plans yet." : "No active plans."}
          </p>
          {!showArchived && (
            <Link href="/plans/new" className="btn-primary inline-flex">Start a plan</Link>
          )}
        </div>
      )}

      <div className="plan-grid">
        {plans.map((p, idx) => {
          const meals = allMeals[idx];
          const total = meals.length;
          const cooked = meals.filter((m) => m.status === "cooked").length;
          const left = total - cooked;
          const pct = total ? (cooked / total) * 100 : 0;
          const preview = meals.slice(0, 5);

          return (
            <div key={p.id} className="card mb-5">
              <div className="px-5 pt-5">
                <p className="num mb-1">Plan · created {fmtCreated(p.created_at)}</p>
                <h2 className="font-display text-2xl leading-tight">{planDisplayName(p)}</h2>
                <p className="text-xs text-stone-500 mt-1">
                  {cooked} of {total} meals cooked{left > 0 ? ` · ${left} to go` : ""}
                </p>
                <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
              </div>
              <div>
                {preview.map((m) => {
                  const r = parseRecipe(m.recipe_json);
                  const dp = fmtDay(m.scheduled_date);
                  const isCooked = m.status === "cooked";
                  return (
                    <Link key={m.id} href={`/meals/${m.id}`} className="meal-row">
                      <div className={`cook-check${isCooked ? " done" : ""}`}>{isCooked ? "✓" : ""}</div>
                      <div className="date-pill">{dp.d}<small>{dp.w}</small></div>
                      <div>
                        <p className={`meal-title${isCooked ? " cooked" : ""}`}>
                          {r?.title ?? "Recipe pending"}
                        </p>
                        <p className={isCooked ? "status-cooked" : "status-planned"}>
                          {isCooked ? "✓ Cooked" : "Planned"}
                        </p>
                      </div>
                      <span className="text-stone-300">›</span>
                    </Link>
                  );
                })}
                {meals.length > preview.length && (
                  <div className="text-center text-xs text-stone-400 py-3">
                    + {meals.length - preview.length} more meals
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-stone-200">
                <Link href={`/plans/${p.id}`} className="btn-ghost w-full inline-flex justify-center">
                  Open plan
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .progress { height: 6px; background: #F1ECE2; border-radius: 9999px; overflow: hidden; margin-top: .5rem; margin-bottom: .85rem; }
        .progress-bar { height: 100%; background: #4A6B4A; border-radius: 9999px; }
        .meal-row { display: grid; grid-template-columns: auto auto 1fr auto; gap: .85rem; align-items: center; padding: .85rem 1rem; border-bottom: 1px solid #ECE6DC; text-decoration: none; color: inherit; }
        .meal-row:last-child { border-bottom: none; }
        .cook-check { width: 24px; height: 24px; border-radius: 9999px; border: 1.5px solid #C8BFB1; display: flex; align-items: center; justify-content: center; font-size: .7rem; }
        .cook-check.done { background: #4A6B4A; border-color: #4A6B4A; color: #fff; }
        .date-pill { font-family: var(--font-display); font-size: .85rem; background: #EAF0E8; color: #4A6B4A; padding: .3rem .55rem; border-radius: 8px; text-align: center; min-width: 46px; line-height: 1.1; }
        .date-pill small { display: block; font-size: .55rem; color: #6B6258; text-transform: uppercase; letter-spacing: .05em; font-family: var(--font-body); margin-top: .1rem; }
        .meal-title { font-size: .92rem; }
        .meal-title.cooked { color: #A8A095; }
        .status-cooked { color: #4A6B4A; font-size: .75rem; }
        .status-planned { color: #A8A095; font-size: .75rem; }
        @media (min-width: 1024px) {
          .plan-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
          .plan-grid .card { margin-bottom: 0; }
        }
      `}</style>
    </>
  );
}
