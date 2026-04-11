import { DeliveryItem, InventoryItemRow, Recipe } from "./types";

export interface MealPreference {
  date: string;
  cuisine: string | null;
  max_minutes: number | null;
  difficulty: string | null; // "Easy" | "Medium" | "Hard" | null
}

export interface SuggestInput {
  delivery: DeliveryItem[];
  pantry: string[];
  inventory?: InventoryItemRow[]; // if present, used instead of delivery+pantry
  meals: MealPreference[];
  adults: number;
  kids: number;
  recentTitles: string[]; // last 30 days, exclude these to keep variety
}

export const SYSTEM_PROMPT = `You are a personal home chef writing recipe cards for a single household. Your job is to plan dinners that use the ingredients the family already has.

Rules:
- ONE recipe per requested cooking night.
- Use the supplied DELIVERY items as the protein/produce backbone. Don't waste them.
- Treat PANTRY items as freely available — don't list them as "to-buy".
- Anything else needed must be marked source: "to-buy".
- Mark delivery items as source: "delivery". Mark pantry items as source: "pantry".
- IMPORTANT: Some items have an "available from" date. Only use items that are available on the night you are planning for. If an item arrives Thursday, do NOT use it for a Wednesday recipe.
- Respect the cuisine preference for each night. If the cuisine is null, choose something complementary that doesn't repeat what's already in the week.
- Respect the max_minutes constraint if set — the TOTAL cook time must not exceed it.
- Respect the difficulty constraint if set.
- Avoid repeating any title in RECENT_MEALS.
- If no time constraint is given, aim for 25-45 minute meals on weeknights. Slow-cook or 60+ min only if the user explicitly asks.
- Portions: scale for ADULTS adults + KIDS kids (kids = ~half adult portion).
- Add a child_note on at least one step per recipe if there's something a kid would object to (chilli, strong herbs, raw garlic, etc.) — explain how to adapt.
- Keep instructions actionable. Number them implicitly via array order; each step gets a "minutes" estimate.
- difficulty must be Easy, Medium, or Hard.
- equipment: list every piece of kitchen equipment needed (e.g. "Large frying pan", "Baking tray", "Blender", "Saucepan"). Be specific — say "Large deep frying pan" not just "Pan".
- Return STRICT JSON matching the provided tool schema. No prose outside the tool call.`;

export function buildUserPrompt(input: SuggestInput): string {
  const { delivery, pantry, inventory, meals, adults, kids, recentTitles } = input;

  const nightLines = meals.map((m, i) => {
    const parts = [`${i + 1}. ${m.date}`];
    parts.push(m.cuisine ? `cuisine: ${m.cuisine}` : "cuisine: chef's choice");
    if (m.max_minutes) parts.push(`max ${m.max_minutes} min`);
    if (m.difficulty) parts.push(`difficulty: ${m.difficulty}`);
    return parts.join(" — ");
  });

  // Use inventory if available (shows remaining quantities after deductions)
  let deliverySection: string;
  let pantrySection: string;

  if (inventory && inventory.length > 0) {
    const invDelivery = inventory.filter((i) => i.source === "delivery");
    const invPantry = inventory.filter((i) => i.source === "pantry");
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
    pantrySection = invPantry
      .map((p) => `- ${p.name}${p.qty ? " (" + p.qty + ")" : ""}`)
      .join("\n") || "(none)";
  } else {
    deliverySection = delivery
      .map((d) => `- ${d.name}${d.qty ? " (" + d.qty + ")" : ""}`)
      .join("\n") || "(none)";
    pantrySection = pantry.map((p) => `- ${p}`).join("\n") || "(none)";
  }

  return `ADULTS: ${adults}
KIDS: ${kids}

DELIVERY (use these first — quantities shown are what REMAINS, plan accordingly):
${deliverySection}

PANTRY (free to use, do NOT list as to-buy):
${pantrySection}

NIGHTS TO PLAN:
${nightLines.join("\n")}

RECENT MEALS (do not repeat):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

Generate exactly ${meals.length} recipes, in order, one per night. Use the suggest_recipes tool.`;
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
          ],
        },
      },
    },
    required: ["recipes"],
  },
} as const;
