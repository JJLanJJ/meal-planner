import { IMAGE_CATEGORIES, type IngredientsInput } from "./types";
import { DEFAULT_PANTRY_STAPLES } from "./pantry-staples";
import type { Recipe } from "./types";

const SYSTEM_PROMPT = `You are a skilled home cook and meal planner. You create practical, delicious dinner recipes for a family of 3. Your recipes are written at a medium-to-advanced cooking skill level — you assume the cook knows basic techniques (dicing, deglazing, emulsifying) but you still provide clear step-by-step instructions.

You always respond with ONLY valid JSON matching the requested schema. No markdown, no code fences, no extra text.`;

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildGenerationPrompt(ingredients: IngredientsInput): string {
  const pantryList = DEFAULT_PANTRY_STAPLES.join(", ");
  const categories = IMAGE_CATEGORIES.join(", ");

  return `I have the following ingredients for the week:

MEATS (from butcher):
${ingredients.meats.map((m) => `- ${m}`).join("\n")}

VEGETABLES (from grocer):
${ingredients.vegetables.map((v) => `- ${v}`).join("\n")}

${ingredients.extras.length > 0 ? `OTHER INGREDIENTS:\n${ingredients.extras.map((e) => `- ${e}`).join("\n")}` : ""}

ASSUMED PANTRY STAPLES:
${pantryList}

Generate exactly 7 dinner recipes (Monday=0 through Sunday=6) for a family of 3.

Requirements:
1. Use ALL the provided meats and vegetables across the week — distribute them sensibly, no ingredient wasted.
2. Vary cooking techniques across the week (don't repeat similar dishes back to back).
3. Include 1-2 quicker meals (under 30 min) for busy weeknights, and allow 1 more ambitious meal for the weekend.
4. For each recipe, list which pantry staples are used AND flag any items needed that weren't in the input or pantry list as "extraItems".
5. Each step should have a stepNumber, title, estimated durationMinutes, and detailed instructions.
6. Assign each recipe an imageCategory from exactly this list: [${categories}]
7. The "ingredients" array should list items with name, quantity (e.g. "500g", "2 medium"), and fromInput (true if from the meats/vegetables/extras list, false if from pantry).

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "dayIndex": 0,
      "title": "Recipe Title",
      "description": "Brief enticing description",
      "totalTimeMinutes": 45,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 30,
      "servings": 3,
      "imageCategory": "chicken",
      "ingredients": [
        {"name": "chicken thighs", "quantity": "500g", "fromInput": true}
      ],
      "pantryItems": ["olive oil", "salt", "pepper"],
      "extraItems": ["fresh basil"],
      "steps": [
        {
          "stepNumber": 1,
          "title": "Prep the chicken",
          "durationMinutes": 5,
          "instructions": "Detailed instructions here...",
          "tip": "Optional chef tip"
        }
      ],
      "tips": "Optional overall recipe tip"
    }
  ]
}`;
}

export function buildRegenerationPrompt(
  ingredients: IngredientsInput,
  existingRecipes: Recipe[],
  dayIndex: number
): string {
  const pantryList = DEFAULT_PANTRY_STAPLES.join(", ");
  const categories = IMAGE_CATEGORIES.join(", ");

  const otherRecipes = existingRecipes
    .filter((r) => r.dayIndex !== dayIndex)
    .map((r) => `- Day ${r.dayIndex}: ${r.title}`)
    .join("\n");

  return `I need a replacement recipe for day ${dayIndex} of my weekly meal plan.

My available ingredients for the week:
MEATS: ${ingredients.meats.join(", ")}
VEGETABLES: ${ingredients.vegetables.join(", ")}
${ingredients.extras.length > 0 ? `OTHER: ${ingredients.extras.join(", ")}` : ""}
PANTRY: ${pantryList}

The other recipes this week are:
${otherRecipes}

Generate ONE different recipe for day ${dayIndex} that:
1. Doesn't duplicate any dish already in the plan
2. Uses a different cooking technique than adjacent days
3. Uses available ingredients (from input or pantry)
4. Assign an imageCategory from: [${categories}]

Return a JSON object with this exact structure (single recipe, not an array):
{
  "dayIndex": ${dayIndex},
  "title": "Recipe Title",
  "description": "Brief enticing description",
  "totalTimeMinutes": 45,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "servings": 3,
  "imageCategory": "chicken",
  "ingredients": [{"name": "...", "quantity": "...", "fromInput": true}],
  "pantryItems": ["olive oil"],
  "extraItems": [],
  "steps": [{"stepNumber": 1, "title": "...", "durationMinutes": 5, "instructions": "...", "tip": "..."}],
  "tips": "Optional"
}`;
}
