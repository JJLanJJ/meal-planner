import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getClient } from "@/lib/claude";
import { getSystemPrompt, buildGenerationPrompt } from "@/lib/prompts";
import { WeeklyPlanSchema, type IngredientsInput } from "@/lib/types";

function getWeekLabel(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const week = Math.ceil(diff / oneWeek);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    const body: IngredientsInput = await request.json();

    if (!body.meats?.length && !body.vegetables?.length) {
      return NextResponse.json(
        { error: "Please add at least some meats or vegetables" },
        { status: 400 }
      );
    }

    const client = getClient();
    const prompt = buildGenerationPrompt(body);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
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
        { error: "Failed to parse AI response as JSON. Please try again." },
        { status: 500 }
      );
    }

    const result = WeeklyPlanSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: "AI response didn't match expected format. Please try again.", details: result.error.issues },
        { status: 500 }
      );
    }

    const plan = result.data;
    const db = getDb();

    const insertPlan = db.prepare(
      "INSERT INTO weekly_plans (week_label, ingredients_json) VALUES (?, ?)"
    );
    const insertRecipe = db.prepare(
      `INSERT INTO recipes (plan_id, day_index, title, description, total_time_minutes, prep_time_minutes, cook_time_minutes, servings, image_category, ingredients_json, pantry_items_json, extra_items_json, steps_json, tips)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const savePlan = db.transaction(() => {
      const { lastInsertRowid } = insertPlan.run(
        getWeekLabel(),
        JSON.stringify(body)
      );
      const planId = Number(lastInsertRowid);

      for (const recipe of plan.recipes) {
        insertRecipe.run(
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
      }

      return planId;
    });

    const planId = savePlan();

    return NextResponse.json({ planId, recipes: plan.recipes });
  } catch (error) {
    console.error("Generate plan error:", error);
    return NextResponse.json(
      { error: "Failed to generate meal plan. Please try again." },
      { status: 500 }
    );
  }
}
