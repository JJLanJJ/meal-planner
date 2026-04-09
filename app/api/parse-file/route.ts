import { NextResponse } from "next/server";
import { z } from "zod";
import { DeliveryItemSchema } from "@/lib/types";

const Body = z.object({
  media_type: z.string(),
  data: z.string(),
  kind: z.enum(["image", "pdf"]),
});

const PARSE_TOOL = {
  name: "extract_delivery_items",
  description:
    "Extract every grocery, butcher, or produce line item from a receipt, order confirmation, or invoice. Skip prices, totals, headers, and marketing.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Ingredient name only — no price or qty" },
            qty: { type: "string", description: 'Quantity with unit, e.g. "500g", "2 pcs"' },
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

  const contentBlock =
    body.kind === "image"
      ? {
          type: "image",
          source: { type: "base64", media_type: body.media_type, data: body.data },
        }
      : {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: body.data },
        };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 4000,
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "extract_delivery_items" },
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract every ingredient/line item from this order using the extract_delivery_items tool. Skip prices, totals, shipping, and marketing fluff.",
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

  const itemsParsed = z.object({ items: z.array(DeliveryItemSchema) }).safeParse(toolUse.input);
  if (!itemsParsed.success) {
    return NextResponse.json(
      { error: "Items schema validation failed", details: itemsParsed.error.message, raw: toolUse.input },
      { status: 502 },
    );
  }

  return NextResponse.json({ items: itemsParsed.data.items });
}
