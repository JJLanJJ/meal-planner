import { NextResponse } from "next/server";
import {
  getPlan,
  listMealsForPlan,
  listInventory,
  refundInventory,
  setMealRecipe,
  deductInventory,
  listPantry,
  recentTitles,
} from "@/lib/repo";
import { getClient } from "@/lib/claude";
import {
  SYSTEM_PROMPT,
  SUGGEST_TOOL,
  buildUserPrompt,
} from "@/lib/prompts";
import { SuggestionsResponseSchema, type Recipe } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST /api/plans/[id]/regenerate
 * Regenerates recipes for all uncooked meals in the plan,
 * using current inventory (with availability dates respected).
 */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const planId = Number(id);
  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });

  const meals = await listMealsForPlan(planId);
  const uncookedMeals = meals.filter((m) => m.status !== "cooked" && m.recipe_json);

  if (uncookedMeals.length === 0) {
    return NextResponse.json({ error: "no uncooked meals to regenerate" }, { status: 400 });
  }

  // Refund old recipe deductions for uncooked meals
  for (const m of uncookedMeals) {
    if (m.recipe_json) {
      try {
        const oldRecipe = JSON.parse(m.recipe_json) as Recipe;
        await refundInventory(planId, oldRecipe);
      } catch {}
    }
  }

  // Get current inventory (after refunds) and other context
  const inventory = await listInventory(planId);
  const recent = await recentTitles(30);
  // Include cooked meals from this plan as "recent" too
  const cookedTitles = meals
    .filter((m) => m.status === "cooked" && m.recipe_json)
    .map((m) => { try { return JSON.parse(m.recipe_json!).title; } catch { return null; } })
    .filter(Boolean) as string[];

  const allRecent = [...new Set([...recent, ...cookedTitles])];

  // Build meal preferences for uncooked nights
  const mealPrefs = uncookedMeals.map((m) => ({
    date: m.scheduled_date,
    cuisine: m.cuisine_pref,
    max_minutes: null as number | null,
    difficulty: null as string | null,
  }));

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TOOL as any],
    tool_choice: { type: "tool", name: "suggest_recipes" } as any,
    messages: [{
      role: "user",
      content: buildUserPrompt({
        delivery: [],
        pantry: [],
        inventory,
        meals: mealPrefs,
        adults: plan.adults,
        kids: plan.kids,
        recentTitles: allRecent,
      }),
    }],
  });

  const toolUse = message.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolUse) {
    return NextResponse.json({ error: "Model did not return a tool call" }, { status: 502 });
  }

  const parsed = SuggestionsResponseSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Recipe validation failed", details: parsed.error.message }, { status: 502 });
  }

  // Update each uncooked meal with new recipe and deduct inventory
  const newRecipes = parsed.data.recipes;
  for (let i = 0; i < uncookedMeals.length && i < newRecipes.length; i++) {
    await setMealRecipe(uncookedMeals[i].id, newRecipes[i]);
    await deductInventory(planId, newRecipes[i]);
  }

  return NextResponse.json({ ok: true, regenerated: newRecipes.length });
}
