import { NextResponse } from "next/server";
import { z } from "zod";
import { addPantryItem, deletePantryItem, listPantry } from "@/lib/repo";

export async function GET() {
  return NextResponse.json({ items: await listPantry() });
}

const Body = z.object({ name: z.string().min(1), category: z.string().default("Other") });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await addPantryItem(parsed.data.name, parsed.data.category);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePantryItem(id);
  return NextResponse.json({ ok: true });
}
