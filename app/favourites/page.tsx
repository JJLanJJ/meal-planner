import Link from "next/link";
import { listFavourites } from "@/lib/repo";
import type { Recipe } from "@/lib/types";
import { FoodImage } from "@/components/FoodImage";

export const dynamic = "force-dynamic";

function parseRecipe(json: string): Recipe | null {
  try { return JSON.parse(json) as Recipe; } catch { return null; }
}



export default async function FavouritesPage() {
  const favs = await listFavourites();

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Favourites</p>
      <h1 className="font-display text-4xl mt-1 mb-6">Saved recipes</h1>

      {favs.length === 0 && (
        <p className="text-sm text-stone-500">No favourites yet. Tap ♡ on a recipe to save it.</p>
      )}

      <div className="fav-grid">
        {favs.map((f) => {
          const r = parseRecipe(f.recipe_json);
          return (
            <div key={f.id} className="card overflow-hidden">
              <FoodImage title={f.title} height={140} />
              <div className="p-4">
                <h2 className="font-display text-lg leading-tight mb-2">{f.title}</h2>
                {r && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="pill">⏱ {r.total_minutes} min</span>
                    <span className="pill">{r.cuisine}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .fav-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        @media (min-width: 640px) { .fav-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .fav-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </>
  );
}
