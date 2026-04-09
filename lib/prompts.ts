import { DeliveryItem, Recipe } from "./types";

export interface SuggestInput {
  delivery: DeliveryItem[];
  pantry: string[];
  meals: { date: string; cuisine: string | null }[];
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
- Respect the cuisine preference for each night. If the cuisine is null, choose something complementary that doesn't repeat what's already in the week.
- Avoid repeating any title in RECENT_MEALS.
- Aim for 25-45 minute meals on weeknights. Slow-cook or 60+ min only if the user explicitly asks.
- Portions: scale for ADULTS adults + KIDS kids (kids = ~half adult portion).
- Add a child_note on at least one step per recipe if there's something a kid would object to (chilli, strong herbs, raw garlic, etc.) — explain how to adapt.
- Keep instructions actionable. Number them implicitly via array order; each step gets a "minutes" estimate.
- difficulty must be Easy, Medium, or Hard.
- Return STRICT JSON matching the provided tool schema. No prose outside the tool call.`;

export function buildUserPrompt(input: SuggestInput): string {
  const { delivery, pantry, meals, adults, kids, recentTitles } = input;
  return `ADULTS: ${adults}
KIDS: ${kids}

DELIVERY (use these first):
${delivery.map((d) => `- ${d.name}${d.qty ? " (" + d.qty + ")" : ""}`).join("\n") || "(none)"}

PANTRY (free to use, do NOT list as to-buy):
${pantry.map((p) => `- ${p}`).join("\n") || "(none)"}

NIGHTS TO PLAN:
${meals
  .map(
    (m, i) =>
      `${i + 1}. ${m.date}${m.cuisine ? ` — cuisine: ${m.cuisine}` : " — cuisine: chef's choice"}`,
  )
  .join("\n")}

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
          ],
        },
      },
    },
    required: ["recipes"],
  },
} as const;
