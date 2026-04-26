import { DeliveryItem, InventoryItemRow, Recipe } from "./types";

export interface MealPreference {
  date: string;
  cuisine: string | null;
  max_minutes: number | null;
  difficulty: string | null; // "Easy" | "Medium" | "Hard" | null
}

export interface KitchenItem {
  name: string;
  qty?: string | null;
  location: string; // 'pantry' | 'fridge' | 'freezer'
}

export interface SuggestInput {
  delivery: DeliveryItem[];
  pantry: KitchenItem[];
  inventory?: InventoryItemRow[]; // if present, used instead of delivery+pantry
  meals: MealPreference[];
  adults: number;
  kids: number;
  recentTitles: string[]; // last 30 days, exclude these to keep variety
  dietary?: string; // free-text dietary requirements (e.g. "vegetarian, low sodium")
  excluded?: string[]; // ingredients the user dislikes / wants avoided
  slowCooker?: boolean; // if true, suggest at least one slow-cooker meal
  recipeSearch?: (string | null)[]; // Tavily snippets per meal night, aligned by index
}

export const SYSTEM_PROMPT = `You are a skilled home cook writing recipe cards for a single household — think Nigel Slater's ease, Kenji López-Alt's technique, and Yotam Ottolenghi's willingness to use bold flavour. Your job is to plan dinners that use the ingredients the family already has, and to make them genuinely worth eating.

QUALITY STANDARDS — every recipe must meet these:
- Build flavour properly. Aromatics (onion, garlic, ginger, shallots) must be cooked until actually ready — softened, caramelised, or fragrant as required. State what to look and smell for. "Cook the onion" is not enough; "cook over medium heat until soft and golden, about 8 minutes" is.
- Use acid to finish. Almost every savoury dish benefits from a squeeze of lemon, a splash of vinegar, a spoon of yoghurt, or a handful of fresh herbs at the end. Include it unless there's a clear reason not to.
- Season in layers. Salt at multiple points in the cook, not just the end.
- Handle protein with care. Specify whether to pat dry before searing, whether to bring to room temperature, how to know when it's done (colour, texture, temp), and when to rest it before cutting.
- Write steps with sensory cues — what to see, smell, or hear. Not "fry until done" but "fry until the skin is deep golden and releases easily from the pan, about 4 minutes per side".
- Don't default to the most generic version of a dish. Give it a specific character — a spice combination, an unusual technique, a finishing touch. A chicken stir-fry should have a point of view.
- Descriptions must sell the dish in 1–2 sentences. Lead with the eating experience, not the ingredient list. Never use "delicious", "easy weeknight", or "simple". Make the reader hungry.

CONSTRAINTS:
- ONE recipe per requested cooking night.
- Use the supplied DELIVERY items as the protein/produce backbone. Don't waste them.
- Treat KITCHEN items (fridge, freezer, pantry) as freely available — don't list them as "to-buy". Mark them source: "pantry".
- FRIDGE items are fresh/perishable — prefer using them up.
- FREEZER items are available but note in the method if something needs to be thawed in advance.
- Anything else needed must be marked source: "to-buy".
- Mark delivery items as source: "delivery".
- IMPORTANT: Some items have an "available from" date. Only use items that are available on the night you are planning for. If an item arrives Thursday, do NOT use it for a Wednesday recipe.
- Respect the cuisine preference for each night. If the cuisine is null, choose something complementary that doesn't repeat what's already in the week.
- Respect the max_minutes constraint if set — the TOTAL cook time must not exceed it.
- Respect the difficulty constraint if set.
- Avoid repeating any title in RECENT_MEALS.
- If no time constraint is given, aim for 25–45 minute meals on weeknights. Slow-cook or 60+ min only if the user explicitly asks.
- Portions: scale for ADULTS adults + KIDS kids (kids = ~half adult portion).
- Add a child_note on at least one step per recipe if there's something a kid would object to (chilli, strong herbs, raw garlic, etc.) — explain how to adapt it, not just omit it.
- Keep instructions actionable. Each step gets a "minutes" estimate.
- difficulty must be Easy, Medium, or Hard.
- equipment: list every piece of kitchen equipment needed. Be specific — "Large cast-iron frying pan" not "Pan".
- If DIETARY requirements are given, every recipe MUST satisfy them (hard constraint, not a preference).
- If AVOID ingredients are listed, do NOT use them in any recipe. Substitute freely.
- If SLOW_COOKER is "yes", plan at least one recipe built around a slow cooker (4–8 hours on low, or 2–4 on high) — braises, stews, pulled meats, soups. Don't force it onto nights with a conflicting max_minutes constraint.
- Every recipe MUST include nutrition estimates per adult serving: calories, protein_g, carbs_g, fat_g. Realistic — a typical dinner plate is 500–800 kcal.
- Every recipe MUST include health_notes: one short sentence (≤20 words) on nutritional character.
- If REFERENCE RECIPES are provided, treat them as creative inspiration — draw on their techniques, flavour combinations, and structure, then adapt freely to the available ingredients. Do not reproduce them verbatim.
- Return STRICT JSON matching the provided tool schema. No prose outside the tool call.`;

export function buildUserPrompt(input: SuggestInput): string {
  const { delivery, pantry, inventory, meals, adults, kids, recentTitles, dietary, excluded, slowCooker, recipeSearch } = input;

  const nightLines = meals.map((m, i) => {
    const parts = [`${i + 1}. ${m.date}`];
    parts.push(m.cuisine ? `cuisine: ${m.cuisine}` : "cuisine: chef's choice");
    if (m.max_minutes) parts.push(`max ${m.max_minutes} min`);
    if (m.difficulty) parts.push(`difficulty: ${m.difficulty}`);
    return parts.join(" — ");
  });

  // Use inventory if available (shows remaining quantities after deductions)
  let deliverySection: string;
  let kitchenSection: string;

  if (inventory && inventory.length > 0) {
    const invDelivery = inventory.filter((i) => i.source === "delivery");
    const invKitchen = inventory.filter((i) => i.source === "pantry");
    deliverySection = invDelivery
      .map((d) => {
        const parts = [`- ${d.name}`];
        const meta: string[] = [];
        if (d.qty) meta.push(`${d.qty} remaining`);
        if (d.available_from) meta.push(`available from ${d.available_from}`);
        if (meta.length) parts.push(`(${meta.join(", ")})`);
        return parts.join(" ");
      })
      .join("\n") || "(none)";
    kitchenSection = invKitchen
      .map((p) => `- ${p.name}${p.qty ? " (" + p.qty + ")" : ""}`)
      .join("\n") || "(none)";
  } else {
    deliverySection = delivery
      .map((d) => `- ${d.name}${d.qty ? " (" + d.qty + ")" : ""}`)
      .join("\n") || "(none)";

    // Group kitchen items by location for Claude's context
    const fridge = pantry.filter((p) => p.location === "fridge");
    const freezer = pantry.filter((p) => p.location === "freezer");
    const shelf = pantry.filter((p) => p.location !== "fridge" && p.location !== "freezer");

    const fmt = (items: KitchenItem[]) =>
      items.map((p) => `- ${p.name}${p.qty ? " (" + p.qty + ")" : ""}`).join("\n") || "(none)";

    kitchenSection =
      `FRIDGE (fresh/perishable — prefer using these up):
${fmt(fridge)}

FREEZER (thaw in advance if needed):
${fmt(freezer)}

PANTRY (always available staples):
${fmt(shelf)}`;
  }

  const dietaryLine = dietary?.trim() ? dietary.trim() : "(none)";
  const excludedLines = excluded && excluded.length > 0
    ? excluded.map((e) => `- ${e}`).join("\n")
    : "(none)";

  return `ADULTS: ${adults}
KIDS: ${kids}
SLOW_COOKER: ${slowCooker ? "yes — plan at least one slow cooker meal" : "no"}

DIETARY REQUIREMENTS (hard constraint — every recipe must comply):
${dietaryLine}

AVOID these ingredients (do not use in any recipe, substitute freely):
${excludedLines}

DELIVERY (use these first — quantities shown are what REMAINS, plan accordingly):
${deliverySection}

KITCHEN — already in your home (mark as source: "pantry", do NOT list as to-buy):
${kitchenSection}

NIGHTS TO PLAN:
${nightLines.join("\n")}

RECENT MEALS (do not repeat):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "(none)"}
${recipeSearch && recipeSearch.some(Boolean) ? `
REFERENCE RECIPES — real recipes found online for inspiration. Draw on their techniques and flavour combinations; adapt freely to the available ingredients. One block per night, in order:
${meals.map((_, i) => {
  const ref = recipeSearch[i];
  return ref ? `Night ${i + 1}:\n${ref}` : `Night ${i + 1}: (no reference found)`;
}).join("\n\n")}` : ""}

Generate exactly ${meals.length} recipes, in order, one per night. Use the suggest_recipes tool.`;
}

export interface QuickMealInput {
  selectedItems: { name: string; qty?: string | null; source: "delivery" | "pantry" }[];
  kitchen: KitchenItem[];
  cuisine: string | null;
  max_minutes: number | null;
  adults: number;
  kids: number;
  recentTitles: string[];
  recipeSearch?: string | null;
}

export function buildQuickPrompt(input: QuickMealInput): string {
  const { selectedItems, kitchen, cuisine, max_minutes, adults, kids, recentTitles, recipeSearch } = input;
  const today = new Date().toISOString().slice(0, 10);

  const selectedLines = selectedItems
    .map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ""} [source: ${i.source}]`)
    .join("\n") || "(none)";

  const fridge = kitchen.filter((p) => p.location === "fridge");
  const freezer = kitchen.filter((p) => p.location === "freezer");
  const shelf = kitchen.filter((p) => p.location !== "fridge" && p.location !== "freezer");
  const fmt = (items: KitchenItem[]) =>
    items.map((p) => `- ${p.name}${p.qty ? " (" + p.qty + ")" : ""}`).join("\n") || "(none)";

  const nightParts = [`1. ${today}`, cuisine ? `cuisine: ${cuisine}` : "cuisine: chef's choice"];
  if (max_minutes) nightParts.push(`max ${max_minutes} min`);

  return `ADULTS: ${adults}
KIDS: ${kids}

COOK TONIGHT — build the recipe around these selected ingredients (all must feature in the dish).
Preserve the [source] tag for each item in your ingredients list:
${selectedLines}

KITCHEN — additional ingredients freely available (mark as source: "pantry"):
FRIDGE (fresh/perishable):
${fmt(fridge)}

FREEZER (thaw in advance if needed):
${fmt(freezer)}

PANTRY (staples):
${fmt(shelf)}

NIGHT TO PLAN:
${nightParts.join(" — ")}

RECENT MEALS (do not repeat):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "(none)"}${recipeSearch ? `\n\nREFERENCE RECIPE — real recipe found online for inspiration. Draw on its techniques; adapt freely:\n${recipeSearch}` : ""}

Generate exactly 1 recipe for tonight. Use the suggest_recipes tool.`;
}

// Tool schema for Claude — drives structured output.
export const SUGGEST_TOOL = {
  name: "suggest_recipes",
  description: "Return the planned recipes for the requested cooking nights.",
  input_schema: {
    type: "object",
    properties: {
      recipes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            cuisine: { type: "string" },
            total_minutes: { type: "integer" },
            prep_minutes: { type: "integer" },
            cook_minutes: { type: "integer" },
            difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  qty: { type: "string" },
                  source: {
                    type: "string",
                    enum: ["delivery", "pantry", "to-buy"],
                  },
                },
                required: ["name", "qty", "source"],
              },
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  minutes: { type: "integer" },
                  instruction: { type: "string" },
                  child_note: { type: "string" },
                },
                required: ["minutes", "instruction"],
              },
            },
            equipment: {
              type: "array",
              items: { type: "string" },
              description: "Kitchen equipment needed, e.g. 'Large frying pan', 'Baking tray', 'Colander'",
            },
            nutrition: {
              type: "object",
              description: "Estimated nutrition per adult serving.",
              properties: {
                calories: { type: "number", description: "kcal per adult serving" },
                protein_g: { type: "number" },
                carbs_g: { type: "number" },
                fat_g: { type: "number" },
              },
              required: ["calories", "protein_g", "carbs_g", "fat_g"],
            },
            health_notes: {
              type: "string",
              description: "One short sentence (≤20 words) on nutritional character.",
            },
          },
          required: [
            "title",
            "description",
            "cuisine",
            "total_minutes",
            "prep_minutes",
            "cook_minutes",
            "difficulty",
            "ingredients",
            "steps",
            "equipment",
            "nutrition",
            "health_notes",
          ],
        },
      },
    },
    required: ["recipes"],
  },
} as const;
