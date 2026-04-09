import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeal } from "@/lib/repo";
import { RecipeSchema } from "@/lib/types";

const Body = z.object({
  scheduled_date: z.string(),
  cuisine_pref: z.string().nullable().default(null),
  recipe: RecipeSchema.nullable().default(null),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const mealId = await createMeal({
    plan_id: Number(id),
    scheduled_date: parsed.data.scheduled_date,
    cuisine_pref: parsed.data.cuisine_pref,
    recipe: parsed.data.recipe,
  });
  return NextResponse.json({ id: mealId });
}
