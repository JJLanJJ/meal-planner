import { z } from "zod";

export const IMAGE_CATEGORIES = [
  "chicken", "beef", "pork", "lamb", "fish", "pasta", "stir-fry",
  "salad", "soup", "roast", "curry", "burger", "tacos", "rice-bowl",
  "baked", "other",
] as const;

export const RecipeIngredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  fromInput: z.boolean(),
});

export const RecipeStepSchema = z.object({
  stepNumber: z.number(),
  title: z.string(),
  durationMinutes: z.number(),
  instructions: z.string(),
  tip: z.string().optional(),
});

export const RecipeSchema = z.object({
  dayIndex: z.number().min(0).max(6),
  title: z.string(),
  description: z.string(),
  totalTimeMinutes: z.number(),
  prepTimeMinutes: z.number(),
  cookTimeMinutes: z.number(),
  servings: z.number().default(3),
  imageCategory: z.string(),
  ingredients: z.array(RecipeIngredientSchema),
  pantryItems: z.array(z.string()),
  extraItems: z.array(z.string()),
  steps: z.array(RecipeStepSchema),
  tips: z.string().optional(),
});

export const WeeklyPlanSchema = z.object({
  recipes: z.array(RecipeSchema).length(7),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RecipeStep = z.infer<typeof RecipeStepSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>;

export interface IngredientsInput {
  meats: string[];
  vegetables: string[];
  extras: string[];
}

export interface SavedPlan {
  id: number;
  weekLabel: string;
  createdAt: string;
  ingredients: IngredientsInput;
  recipes: Recipe[];
}

export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
] as const;
