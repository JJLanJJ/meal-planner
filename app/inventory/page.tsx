import Link from "next/link";
import { listActiveInventory } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const items = await listActiveInventory();

  // Group by ingredient name (case-insensitive) so the same thing showing up
  // across multiple active plans collapses into one heading with its sources
  // listed underneath.
  const groups = new Map<
    string,
    {
      displayName: string;
      source: "delivery" | "pantry";
      category: string;
      entries: {
        qty: string | null;
        planId: number;
        planName: string;
        availableFrom: string | null;
      }[];
    }
  >();
  for (const it of items) {
    const key = `${it.source}::${it.name.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        displayName: it.name,
        source: it.source,
        category: it.category,
        entries: [],
      });
    }
    groups.get(key)!.entries.push({
      qty: it.qty,
      planId: it.plan_id,
      planName: it.plan_name ?? `Plan ${it.plan_id}`,
      availableFrom: it.available_from,
    });
  }

  const delivery = [...groups.values()].filter((g) => g.source === "delivery");
  const pantry = [...groups.values()].filter((g) => g.source === "pantry");

  // Group delivery items by their food category for display.
  const deliveryByCategory = new Map<string, typeof delivery>();
  for (const g of delivery) {
    if (!deliveryByCategory.has(g.category)) deliveryByCategory.set(g.category, []);
    deliveryByCategory.get(g.category)!.push(g);
  }

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Inventory</p>
      <h1 className="font-display text-4xl mt-1 mb-2">What&rsquo;s in the kitchen</h1>
      <p className="text-xs text-stone-500 mb-6">
        {items.length === 0
          ? "No active plans — deliveries and pantry show here once you start a plan."
          : `Everything currently available across ${distinctPlans(items)} active plan${
              distinctPlans(items) === 1 ? "" : "s"
            }. Quantities shrink as meals are saved.`}
      </p>

      {delivery.length > 0 && (
        <>
          <p className="num mb-2">From deliveries</p>
          {[...deliveryByCategory.entries()].map(([cat, group]) => (
            <div key={cat} className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">{cat}</p>
              <div className="card">
                {group.map((g) => (
                  <div key={g.displayName} className="inv-row">
                    <div className="flex-1">
                      <p className="text-sm">{g.displayName}</p>
                      {g.entries.map((e, i) => (
                        <p key={i} className="text-[11px] text-stone-500">
                          {e.qty ? `${e.qty} · ` : ""}
                          <Link href={`/plans/${e.planId}`} className="underline decoration-dotted">
                            {e.planName}
                          </Link>
                          {e.availableFrom && ` · arrives ${formatDate(e.availableFrom)}`}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {pantry.length > 0 && (
        <>
          <p className="num mt-2 mb-2">Pantry</p>
          <div className="card mb-6">
            {pantry
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((g) => (
                <div key={g.displayName} className="inv-row">
                  <span className="flex-1 text-sm">{g.displayName}</span>
                  <span className="text-xs text-stone-400">
                    shared · {g.entries.length} plan{g.entries.length === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-stone-500">
            Start a new plan from the <Link href="/plans/new" className="text-sage underline">New plan</Link> page to populate this view.
          </p>
        </div>
      )}

      <style>{`
        .inv-row {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.7rem 1rem;
          border-bottom: 1px solid #ECE6DC;
        }
        .inv-row:last-child { border-bottom: none; }
      `}</style>
    </>
  );
}

function distinctPlans(
  items: { plan_id: number }[],
): number {
  return new Set(items.map((i) => i.plan_id)).size;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
