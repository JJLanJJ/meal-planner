import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlan, listPlans, listPantry, populateInventory } from "@/lib/repo";
import { DeliveryItemSchema } from "@/lib/types";

const Body = z.object({
  name: z.string().nullable().default(null),
  adults: z.number().int().min(1),
  kids: z.number().int().min(0),
  delivery: z.array(DeliveryItemSchema),
});

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") as
    | "active"
    | "archived"
    | null;
  return NextResponse.json({ plans: await listPlans(status ?? undefined) });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const id = await createPlan(parsed.data);

  // Populate inventory from delivery items + pantry
  const pantryItems = await listPantry();
  await populateInventory(id, parsed.data.delivery, pantryItems);

  return NextResponse.json({ id });
}
