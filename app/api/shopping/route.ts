import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addShoppingItem,
  deleteShoppingItem,
  listShopping,
  toggleShopping,
} from "@/lib/repo";

export async function GET() {
  return NextResponse.json({ items: await listShopping() });
}

const PostBody = z.object({ name: z.string().min(1), qty: z.string().nullable().default(null) });

export async function POST(req: Request) {
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await addShoppingItem(parsed.data.name, parsed.data.qty);
  return NextResponse.json({ ok: true });
}

const PatchBody = z.object({ id: z.number(), ticked: z.boolean() });

export async function PATCH(req: Request) {
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await toggleShopping(parsed.data.id, parsed.data.ticked);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteShoppingItem(id);
  return NextResponse.json({ ok: true });
}
