import { NextResponse } from "next/server";
import { z } from "zod";
import { DeliveryItemSchema } from "@/lib/types";

export const maxDuration = 30;

const Body = z.object({
  media_type: z.string(),
  data: z.string(),
});

const PANTRY_VISION_TOOL = {
  name: "identify_pantry_items",
  description:
    "Identify every distinct food item, ingredient, or packaged product visible in the photo. Read labels if present — brand names should be dropped, only the food itself (e.g. 'diced tomatoes', not 'Mutti Diced Tomatoes'). If a net weight or volume is printed on the package, record it as qty.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Plain food name — e.g. 'olive oil', 'chickpeas', 'red onion'. No brand names.",
            },
            qty: {
              type: "string",
              description:
                "Net weight or volume printed on the package (e.g. '400g', '500ml'). Omit if not visible.",
            },
            category: {
              type: "string",
              enum: ["meat", "produce", "dairy", "other"],
            },
          },
          required: ["name", "category"],
        },
      },
    },
    required: ["items"],
  },
} as const;

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      tools: [PANTRY_VISION_TOOL],
      tool_choice: { type: "tool", name: "identify_pantry_items" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: body.media_type, data: body.data },
            },
            {
              type: "text",
              text: "Identify every food item visible in this photo using the identify_pantry_items tool. It might be a single package, a loose ingredient, or multiple items on a shelf — return whatever you can see. Drop brand names, keep the food itself.",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Anthropic API error", status: res.status, details: text }, { status: 502 });
  }

  const json = await res.json();
  const toolUse = json.content?.find((b: any) => b.type === "tool_use");
  if (!toolUse) {
    return NextResponse.json({ error: "Model did not return a tool call", raw: json.content }, { status: 502 });
  }

  const parsed = z.object({ items: z.array(DeliveryItemSchema) }).safeParse(toolUse.input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Items schema validation failed", details: parsed.error.message, raw: toolUse.input },
      { status: 502 },
    );
  }

  return NextResponse.json({ items: parsed.data.items });
}
