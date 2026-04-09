import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getClient } from "@/lib/claude";
import { getSystemPrompt, buildRegenerationPrompt } from "@/lib/prompts";
import { RecipeSchema, type IngredientsInput, type Recipe } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { planId, dayIndex } = await request.json();

    const db = getDb();

    const plan = db
      .prepare("SELECT * FROM weekly_plans WHERE id = ?")
      .get(planId) as { id: number; ingredients_json: string } | undefined;

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const ingredients: IngredientsInput = JSON.parse(plan.ingredients_json);

    const recipeRows = db
      .prepare("SELECT * FROM recipes WHERE plan_id = ?")
      .all(planId) as Array<{
      day_index: number;
      title: string;
      description: string;
      total_time_minutes: number;
      prep_time_minutes: number;
      cook_time_minutes: number;
      servings: number;
      image_category: string;
      ingredients_json: string;
      pantry_items_json: string;
      extra_items_json: string;
      steps_json: string;
      tips: string | null;
    }>;

    const existingRecipes: Recipe[] = recipeRows.map((r) => ({
      dayIndex: r.day_index,
      title: r.title,
      description: r.description,
      totalTimeMinutes: r.total_time_minutes,
      prepTimeMinutes: r.prep_time_minutes,
      cookTimeMinutes: r.cook_time_minutes,
      servings: r.servings,
      imageCategory: r.image_category,
      ingredients: JSON.parse(r.ingredients_json),
      pantryItems: JSON.parse(r.pantry_items_json),
      extraItems: JSON.parse(r.extra_items_json),
      steps: JSON.parse(r.steps_json),
      tips: r.tips || undefined,
    }));

    const client = getClient();
    const prompt = buildRegenerationPrompt(ingredients, existingRecipes, dayIndex);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: getSystemPrompt(),
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    const result = RecipeSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: "AI response didn't match expected format. Please try again." },
        { status: 500 }
      );
    }

    const recipe = result.data;

    db.prepare("DELETE FROM recipes WHERE plan_id = ? AND day_index = ?").run(
      planId,
      dayIndex
    );

    db.prepare(
      `INSERT INTO recipes (plan_id, day_index, title, description, total_time_minutes, prep_time_minutes, cook_time_minutes, servings, image_category, ingredients_json, pantry_items_json, extra_items_json, steps_json, tips)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      planId,
      recipe.dayIndex,
      recipe.title,
      recipe.description,
      recipe.totalTimeMinutes,
      recipe.prepTimeMinutes,
      recipe.cookTimeMinutes,
      recipe.servings,
      recipe.imageCategory,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.pantryItems),
      JSON.stringify(recipe.extraItems),
      JSON.stringify(recipe.steps),
      recipe.tips || null
    );

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Regenerate recipe error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate recipe. Please try again." },
      { status: 500 }
    );
  }
}
