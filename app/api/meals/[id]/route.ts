import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getMeal,
  deleteMeal,
  markMealCooked,
  setMealRecipe,
  unmarkMealCooked,
  updateMealRating,
  deductInventory,
  deductPantryOnCook,
  refundPantryOnUncook,
} from "@/lib/repo";
import { RecipeSchema, type Recipe } from "@/lib/types";

const Patch = z.object({
  status: z.enum(["planned", "cooked"]).optional(),
  recipe: RecipeSchema.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meal = await getMeal(Number(id));
  if (!meal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ meal });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const mealId = Number(id);
  if (parsed.data.recipe) {
    await setMealRecipe(mealId, parsed.data.recipe);
    const meal = await getMeal(mealId);
    if (meal) await deductInventory(meal.plan_id, parsed.data.recipe);
  }
  if (parsed.data.status === "cooked") {
    const meal = await getMeal(mealId);
    if (meal?.recipe_json) {
      try { await deductPantryOnCook(JSON.parse(meal.recipe_json) as Recipe); } catch {}
    }
    await markMealCooked(mealId);
  }
  if (parsed.data.status === "planned") {
    const meal = await getMeal(mealId);
    if (meal?.recipe_json) {
      try { await refundPantryOnUncook(JSON.parse(meal.recipe_json) as Recipe); } catch {}
    }
    await unmarkMealCooked(mealId);
  }
  if (parsed.data.rating !== undefined) await updateMealRating(mealId, parsed.data.rating);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meal = await getMeal(Number(id));
  if (!meal) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (meal.status === "cooked") return NextResponse.json({ error: "cannot delete a cooked meal" }, { status: 400 });
  await deleteMeal(Number(id));
  return NextResponse.json({ ok: true });
}
