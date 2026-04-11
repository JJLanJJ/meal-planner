import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan, listMealsForPlan, listInventory } from "@/lib/repo";
import { planDisplayName, type Recipe } from "@/lib/types";
import { DeletePlan } from "./DeletePlan";
import { Inventory } from "./Inventory";

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

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(Number(id));
  if (!plan) notFound();
  const meals = await listMealsForPlan(plan.id);
  const inventory = await listInventory(plan.id);
  const total = meals.length;
  const cooked = meals.filter((m) => m.status === "cooked").length;
  const left = total - cooked;
  const pct = total ? (cooked / total) * 100 : 0;

  return (
    <>
      <Link href="/plans" className="text-xs text-stone-500">← all plans</Link>
      <p className="num mt-6">
        Plan · created {new Date(plan.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
      </p>
      <h1 className="font-display text-4xl mt-1 mb-2">{planDisplayName(plan)}</h1>
      <p className="text-xs text-stone-500 mb-1">
        {cooked} of {total} meals cooked{left > 0 ? ` · ${left} to go` : ""}
      </p>
      <div className="progress mb-6"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>

      <div className="card">
        {meals.length === 0 && <p className="text-sm text-stone-500 p-4">No meals in this plan.</p>}
        {meals.map((m) => {
          const r = parseRecipe(m.recipe_json);
          const dp = fmtDay(m.scheduled_date);
          const isCooked = m.status === "cooked";
          return (
            <Link key={m.id} href={`/meals/${m.id}`} className="meal-row">
              <div className={`cook-check${isCooked ? " done" : ""}`}>{isCooked ? "✓" : ""}</div>
              <div className="date-pill">{dp.d}<small>{dp.w}</small></div>
              <div>
                <p className={`meal-title${isCooked ? " cooked" : ""}`}>{r?.title ?? "Recipe pending"}</p>
                <p className={isCooked ? "status-cooked" : "status-planned"}>
                  {isCooked ? "✓ Cooked" : ""}
                  {isCooked && (r?.cuisine || m.cuisine_pref) ? " · " : ""}
                  {r?.cuisine ?? m.cuisine_pref ?? ""}
                </p>
              </div>
              <span className="text-stone-300">›</span>
            </Link>
          );
        })}
      </div>

      {inventory.length > 0 && <Inventory planId={plan.id} items={inventory} />}

      <DeletePlan planId={plan.id} />

      <style>{`
        .progress { height: 6px; background: #F1ECE2; border-radius: 9999px; overflow: hidden; }
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
      `}</style>
    </>
  );
}
