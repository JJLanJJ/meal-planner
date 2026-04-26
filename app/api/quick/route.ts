import { NextResponse } from "next/server";
import { getClient } from "@/lib/claude";
import { SYSTEM_PROMPT, SUGGEST_TOOL, buildQuickPrompt } from "@/lib/prompts";
import { RecipeSchema } from "@/lib/types";
import {
  getTodaysMeal,
  getDefaultHousehold,
  getMostRecentActivePlanId,
  createPlan,
  createMeal,
  setMealRecipe,
  recentTitles,
} from "@/lib/repo";
import { searchRecipes } from "@/lib/recipe-search";
import { z } from "zod";

const SelectedItemSchema = z.object({
  name: z.string(),
  qty: z.string().nullable().optional(),
  source: z.enum(["delivery", "pantry"]),
});

const KitchenItemSchema = z.object({
  name: z.string(),
  qty: z.string().nullable().optional(),
  location: z.string().default("pantry"),
});

const Body = z.object({
  selectedItems: z.array(SelectedItemSchema),
  kitchen: z.array(KitchenItemSchema),
  cuisine: z.string().nullable().default(null),
  max_minutes: z.number().int().nullable().default(null),
  adults: z.number().int().min(1),
  kids: z.number().int().min(0),
  force: z.boolean().default(false),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const [todaysMeal, hh] = await Promise.all([getTodaysMeal(), getDefaultHousehold()]);

  let existingTitle: string | null = null;
  if (todaysMeal?.recipe_json) {
    try { existingTitle = JSON.parse(todaysMeal.recipe_json).title ?? null; } catch {}
  }

  return NextResponse.json({
    meal: todaysMeal ? { id: todaysMeal.id, title: existingTitle } : null,
    adults: hh.adults,
    kids: hh.kids,
  });
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request body", details: err.message }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysMeal = await getTodaysMeal();

  if (todaysMeal && !body.force) {
    let title: string | null = null;
    if (todaysMeal.recipe_json) {
      try { title = JSON.parse(todaysMeal.recipe_json).title ?? null; } catch {}
    }
    return NextResponse.json({ conflict: true, existingTitle: title }, { status: 409 });
  }

  // Tavily search for one recipe reference
  const recipeSearch = await searchRecipes(
    [body.cuisine, body.selectedItems[0]?.name, "recipe dinner"].filter(Boolean).join(" "),
  ).catch(() => null);

  const titles = await recentTitles(30);

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TOOL as any],
    tool_choice: { type: "tool", name: "suggest_recipes" } as any,
    messages: [{
      role: "user",
      content: buildQuickPrompt({
        selectedItems: body.selectedItems,
        kitchen: body.kitchen,
        cuisine: body.cuisine,
        max_minutes: body.max_minutes,
        adults: body.adults,
        kids: body.kids,
        recentTitles: titles,
        recipeSearch,
      }),
    }],
  });

  const toolUse = message.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolUse) {
    return NextResponse.json({ error: "Model did not return a tool call" }, { status: 502 });
  }

  const recipesInput = toolUse.input?.recipes;
  if (!Array.isArray(recipesInput) || recipesInput.length === 0) {
    return NextResponse.json({ error: "No recipes in tool response" }, { status: 502 });
  }

  const parsed = RecipeSchema.safeParse(recipesInput[0]);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Recipe schema validation failed", details: parsed.error.message },
      { status: 502 },
    );
  }

  const recipe = parsed.data;

  // Save the meal — overwrite or create
  let mealId: number;
  if (todaysMeal) {
    mealId = todaysMeal.id;
    await setMealRecipe(mealId, recipe);
  } else {
    let planId = await getMostRecentActivePlanId();
    if (!planId) {
      const hh = await getDefaultHousehold();
      planId = await createPlan({ name: "Quick Meals", adults: hh.adults, kids: hh.kids, delivery: [] });
    }
    mealId = await createMeal({ plan_id: planId, scheduled_date: today, cuisine_pref: body.cuisine, recipe });
  }

  return NextResponse.json({ mealId, recipe });
}
