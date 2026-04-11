import { NextResponse } from "next/server";
import { getClient } from "@/lib/claude";
import { SYSTEM_PROMPT, SUGGEST_TOOL, buildUserPrompt } from "@/lib/prompts";
import { SuggestionsResponseSchema, DeliveryItemSchema } from "@/lib/types";
import { listInventory } from "@/lib/repo";
import { z } from "zod";

const Body = z.object({
  delivery: z.array(DeliveryItemSchema),
  pantry: z.array(z.string()),
  planId: z.number().int().optional(), // if set, uses inventory (remaining quantities)
  meals: z.array(
    z.object({
      date: z.string(),
      cuisine: z.string().nullable(),
      max_minutes: z.number().int().nullable().default(null),
      difficulty: z.string().nullable().default(null),
    }),
  ),
  adults: z.number().int().min(1),
  kids: z.number().int().min(0),
  recentTitles: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request body", details: err.message }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 500 },
    );
  }

  // If planId is set, fetch current inventory (remaining quantities)
  const inventory = body.planId ? await listInventory(body.planId) : undefined;

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TOOL as any],
    tool_choice: { type: "tool", name: "suggest_recipes" } as any,
    messages: [{ role: "user", content: buildUserPrompt({ ...body, inventory }) }],
  });

  const toolUse = message.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolUse) {
    return NextResponse.json(
      { error: "Model did not return a tool call", raw: message.content },
      { status: 502 },
    );
  }

  const parsed = SuggestionsResponseSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Recipe schema validation failed", details: parsed.error.message, raw: toolUse.input },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data);
}
