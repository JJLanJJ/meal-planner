import { NextResponse } from "next/server";
import { z } from "zod";
import { addPantryItem, deletePantryItem, listPantry, updatePantryItem } from "@/lib/repo";

export async function GET() {
  return NextResponse.json({ items: await listPantry() });
}

const Body = z.object({
  name: z.string().min(1),
  category: z.string().default("Other"),
  qty: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await addPantryItem(parsed.data.name, parsed.data.category, parsed.data.qty);
  return NextResponse.json({ ok: true });
}

const PatchBody = z.object({
  id: z.number(),
  name: z.string().optional(),
  qty: z.string().nullable().optional(),
  category: z.string().optional(),
});

export async function PATCH(req: Request) {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  await updatePantryItem(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePantryItem(id);
  return NextResponse.json({ ok: true });
}
