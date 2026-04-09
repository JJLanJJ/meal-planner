import { NextResponse } from "next/server";
import { addFavourite, deleteFavourite, listFavourites } from "@/lib/repo";
import { RecipeSchema } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ items: await listFavourites() });
}

export async function POST(req: Request) {
  const parsed = RecipeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await addFavourite(parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteFavourite(id);
  return NextResponse.json({ ok: true });
}
