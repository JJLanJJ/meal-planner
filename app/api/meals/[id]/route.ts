import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getMeal,
  markMealCooked,
  setMealRecipe,
  unmarkMealCooked,
  deductInventory,
} from "@/lib/repo";
import { RecipeSchema } from "@/lib/types";

const Patch = z.object({
  status: z.enum(["planned", "cooked"]).optional(),
  recipe: RecipeSchema.optional(),
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
    // Deduct new recipe's ingredients from plan inventory
    const meal = await getMeal(mealId);
    if (meal) await deductInventory(meal.plan_id, parsed.data.recipe);
  }
  if (parsed.data.status === "cooked") await markMealCooked(mealId);
  if (parsed.data.status === "planned") await unmarkMealCooked(mealId);
  return NextResponse.json({ ok: true });
}
