import { NextResponse } from "next/server";
import { z } from "zod";
import { listInventory, deleteInventoryItem, updateInventoryItem, addToInventory } from "@/lib/repo";
import { DeliveryItemSchema } from "@/lib/types";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const items = await listInventory(Number(id));
  return NextResponse.json({ items });
}

const DeliveryItemWithDate = DeliveryItemSchema.extend({
  available_from: z.string().optional(),
});

const PostBody = z.object({
  items: z.array(DeliveryItemWithDate),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await addToInventory(Number(id), parsed.data.items);
  return NextResponse.json({ ok: true });
}

const PatchBody = z.object({
  action: z.enum(["delete", "update"]),
  itemId: z.number(),
  name: z.string().optional(),
  qty: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { action, itemId, name, qty } = parsed.data;
  if (action === "delete") {
    await deleteInventoryItem(itemId);
  } else {
    await updateInventoryItem(itemId, { name, qty: qty ?? undefined });
  }
  return NextResponse.json({ ok: true });
}
