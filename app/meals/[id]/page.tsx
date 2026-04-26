import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeal, getPlan } from "@/lib/repo";
import { planDisplayName, type Recipe } from "@/lib/types";
import { MealActions } from "./MealActions";
import { MethodSteps } from "./MethodSteps";
import { IngredientsFloatButton } from "./IngredientsFloatButton";
import { FoodImage } from "@/components/FoodImage";

export const dynamic = "force-dynamic";

function parseRecipe(json: string | null): Recipe | null {
  if (!json) return null;
  try { return JSON.parse(json) as Recipe; } catch { return null; }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}



export default async function MealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meal = await getMeal(Number(id));
  if (!meal) notFound();
  const recipe = parseRecipe(meal.recipe_json);
  const plan = await getPlan(meal.plan_id);

  if (!recipe) {
    return (
      <>
        <Link href={plan ? `/plans/${plan.id}` : "/plans"} className="text-xs text-stone-500">← back</Link>
        <div className="card p-6 mt-6 text-center">
          <p className="text-stone-500 text-sm">Recipe not generated yet.</p>
        </div>
      </>
    );
  }

  const isCooked = meal.status === "cooked";

  return (
    <>
      <Link href={plan ? `/plans/${plan.id}` : "/plans"} className="text-xs text-stone-500">← back</Link>

      <div className="recipe-grid mt-4">
        <div className="ga-photo">
          <div style={{ borderRadius: 20, overflow: "hidden" }}>
            <FoodImage title={recipe.title} cuisine={recipe.cuisine} description={recipe.description} height={280} />
          </div>
        </div>

        <div className="ga-head">
          <p className="num text-xs uppercase tracking-widest mb-2">
            {fmtDate(meal.scheduled_date)}{plan ? ` · ${planDisplayName(plan)}` : ""}
          </p>
          <h1 className="font-display text-4xl leading-tight mb-3">{recipe.title}</h1>
          <p className="text-stone-600 text-sm mb-5">{recipe.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="pill">⏱ {recipe.total_minutes} min total</span>
            <span className="pill">{recipe.prep_minutes} prep</span>
            <span className="pill">{recipe.cook_minutes} cook</span>
            <span className="pill">{recipe.cuisine}</span>
            <span className="pill">{recipe.difficulty}</span>
            {recipe.nutrition && <span className="pill">🔥 {Math.round(recipe.nutrition.calories)} kcal</span>}
          </div>
          {recipe.nutrition && (
            <div className="card p-4 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Per adult serving</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="font-display text-xl">{Math.round(recipe.nutrition.calories)}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">kcal</p>
                </div>
                <div>
                  <p className="font-display text-xl">{Math.round(recipe.nutrition.protein_g)}g</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">protein</p>
                </div>
                <div>
                  <p className="font-display text-xl">{Math.round(recipe.nutrition.carbs_g)}g</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">carbs</p>
                </div>
                <div>
                  <p className="font-display text-xl">{Math.round(recipe.nutrition.fat_g)}g</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">fat</p>
                </div>
              </div>
              {recipe.health_notes && (
                <p className="text-xs text-stone-600 mt-3 italic">{recipe.health_notes}</p>
              )}
            </div>
          )}
          <MealActions mealId={meal.id} isCooked={isCooked} rating={meal.rating ?? null} recipe={recipe} />
        </div>

        <div className="ga-ing" id="ingredients-section">
          <h2 className="font-display text-xl mb-3">Ingredients</h2>
          <div className="card p-4 mb-3">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="ing">
                <span><span className={`dot d-${ing.source}`}></span>{ing.name}</span>
                <span className="text-stone-500">{ing.qty}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-stone-500 flex-wrap">
            <span><span className="dot d-delivery"></span>From delivery</span>
            <span><span className="dot d-pantry"></span>Pantry</span>
            <span><span className="dot d-to-buy"></span>To buy</span>
          </div>

          {recipe.equipment && recipe.equipment.length > 0 && (
            <div className="mt-5">
              <h2 className="font-display text-xl mb-3">Equipment</h2>
              <div className="card p-4">
                <ul className="text-sm space-y-2">
                  {recipe.equipment.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span style={{ color: "#4A6B4A" }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="ga-method">
          <h2 className="font-display text-xl mb-2 mt-4">Method</h2>
          <MethodSteps steps={recipe.steps} />
        </div>
      </div>

      <IngredientsFloatButton ingredientsId="ingredients-section" />

      <style>{`
        .ing { display: flex; justify-content: space-between; padding: .6rem 0; border-bottom: 1px solid #ECE6DC; font-size: .9rem; }
        .ing:last-child { border-bottom: none; }
        .dot { display: inline-block; width: .5rem; height: .5rem; border-radius: 9999px; margin-right: .5rem; vertical-align: middle; }
        .d-delivery { background: #4A6B4A; }
        .d-pantry { background: #B8A582; }
        .d-to-buy { background: #D9803A; }
        .step { display: grid; grid-template-columns: auto 1fr; gap: 1.25rem; padding: 1.5rem 0; border-bottom: 1px solid #ECE6DC; }
        .step:last-child { border-bottom: none; }
        .step-num { font-family: var(--font-display); font-size: 2rem; line-height: 1; color: #4A6B4A; }
        .child-note { background: #FBEFD9; border-left: 3px solid #D9803A; padding: .6rem .8rem; margin-top: .5rem; font-size: .8rem; color: #8B5A1F; border-radius: 0 6px 6px 0; }
        .recipe-grid { display: block; }
        @media (min-width: 1024px) {
          .recipe-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem 2.5rem;
            max-width: 1100px;
            grid-template-areas: "photo head" "ing method";
            align-items: start;
          }
          .ga-photo { grid-area: photo; }
          .ga-photo .photo { height: 380px !important; }
          .ga-head { grid-area: head; }
          .ga-ing { grid-area: ing; }
          .ga-method { grid-area: method; }
        }
      `}</style>
    </>
  );
}
