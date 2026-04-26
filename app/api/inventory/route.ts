import { NextResponse } from "next/server";
import { updateInventoryItem, deleteInventoryItem } from "@/lib/repo";
import { z } from "zod";

const PatchBody = z.object({
  id: z.number(),
  qty: z.string().nullable().optional(),
  name: z.string().optional(),
  location: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { id, ...patch } = parsed.data;
  await updateInventoryItem(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteInventoryItem(id);
  return NextResponse.json({ ok: true });
}
