import Link from "next/link";
import { listHistory } from "@/lib/repo";
import type { Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRecipe(json: string | null): Recipe | null {
  if (!json) return null;
  try { return JSON.parse(json) as Recipe; } catch { return null; }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

export default async function HistoryPage() {
  const cooked = await listHistory();

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">History</p>
      <h1 className="font-display text-4xl mt-1 mb-6">Cooked meals</h1>

      {cooked.length === 0 && <p className="text-sm text-stone-500">Nothing cooked yet.</p>}

      <div className="hist-grid">
        {cooked.map((m) => {
          const r = parseRecipe(m.recipe_json);
          return (
            <Link key={m.id} href={`/meals/${m.id}`} className="card block p-4">
              <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">
                {fmtDate(m.cooked_at)}{m.plan_name ? ` · ${m.plan_name}` : ""}
              </p>
              <h2 className="font-display text-base leading-tight mb-2">
                {r?.title ?? "Untitled"}
              </h2>
              {r && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="pill">{r.cuisine}</span>
                  <span className="pill">⏱ {r.total_minutes} min</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <style>{`
        .hist-grid { display: grid; grid-template-columns: 1fr; gap: .85rem; }
        @media (min-width: 640px) { .hist-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .hist-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </>
  );
}
