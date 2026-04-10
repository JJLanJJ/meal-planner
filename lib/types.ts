import { z } from "zod";

export const IngredientSourceEnum = z.enum(["delivery", "pantry", "to-buy"]);
export type IngredientSource = z.infer<typeof IngredientSourceEnum>;

export const RecipeIngredientSchema = z.object({
  name: z.string(),
  qty: z.string(),
  source: IngredientSourceEnum,
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const RecipeStepSchema = z.object({
  minutes: z.number().int().nonnegative(),
  instruction: z.string(),
  child_note: z.string().optional(),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cuisine: z.string(),
  total_minutes: z.number().int().positive(),
  prep_minutes: z.number().int().nonnegative(),
  cook_minutes: z.number().int().nonnegative(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(RecipeStepSchema),
  equipment: z.array(z.string()).default([]),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const SuggestionsResponseSchema = z.object({
  recipes: z.array(RecipeSchema),
});
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

// Parsed delivery item
export const DeliveryItemSchema = z.object({
  name: z.string(),
  qty: z.string().optional(),
  category: z.enum(["meat", "produce", "dairy", "other"]).default("other"),
});
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;

// DB row types
export interface PlanRow {
  id: number;
  name: string | null;
  created_at: string;
  adults: number;
  kids: number;
  status: "active" | "archived";
  rating: number | null;
  notes: string | null;
  archived_at: string | null;
  delivery_json: string;
}

export interface MealRow {
  id: number;
  plan_id: number;
  scheduled_date: string;
  cuisine_pref: string | null;
  recipe_json: string | null;
  status: "planned" | "cooked" | "skipped";
  cooked_at: string | null;
}

export interface PantryItemRow {
  id: number;
  name: string;
  category: string;
}

export interface ShoppingItemRow {
  id: number;
  name: string;
  qty: string | null;
  source_meal_id: number | null;
  ticked: number;
  added_at: string;
}

export interface FavouriteRow {
  id: number;
  recipe_json: string;
  title: string;
  saved_at: string;
}

export function planDisplayName(p: PlanRow): string {
  if (p.name && p.name.trim()) return p.name;
  const d = new Date(p.created_at);
  return `Plan from ${d.toLocaleDateString("en-AU", { month: "short", day: "numeric" })}`;
}
