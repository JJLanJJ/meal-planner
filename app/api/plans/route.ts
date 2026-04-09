import { NextResponse } from "next/server";
import { getDb } from "@/db";
import type { Recipe, SavedPlan } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");
    const db = getDb();

    if (planId) {
      const plan = db
        .prepare("SELECT * FROM weekly_plans WHERE id = ?")
        .get(Number(planId)) as
        | { id: number; week_label: string; created_at: string; ingredients_json: string }
        | undefined;

      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      const recipeRows = db
        .prepare("SELECT * FROM recipes WHERE plan_id = ? ORDER BY day_index")
        .all(plan.id) as Array<{
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

      const recipes: Recipe[] = recipeRows.map((r) => ({
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

      const result: SavedPlan = {
        id: plan.id,
        weekLabel: plan.week_label,
        createdAt: plan.created_at,
        ingredients: JSON.parse(plan.ingredients_json),
        recipes,
      };

      return NextResponse.json(result);
    }

    // List all plans
    const plans = db
      .prepare("SELECT id, week_label, created_at FROM weekly_plans ORDER BY created_at DESC")
      .all() as Array<{ id: number; week_label: string; created_at: string }>;

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Plans API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
