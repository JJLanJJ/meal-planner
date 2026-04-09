import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePlan, getPlan, listMealsForPlan, updatePlan } from "@/lib/repo";

const Patch = z.object({
  name: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const plan = await getPlan(Number(id));
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ plan, meals: await listMealsForPlan(plan.id) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = { ...parsed.data };
  if (patch.status === "archived" && !("archived_at" in patch)) {
    (patch as any).archived_at = new Date().toISOString();
  }
  await updatePlan(Number(id), patch as any);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deletePlan(Number(id));
  return NextResponse.json({ ok: true });
}
