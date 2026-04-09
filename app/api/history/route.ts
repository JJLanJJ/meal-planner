import { NextResponse } from "next/server";
import { listHistory } from "@/lib/repo";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const minRating = u.searchParams.get("minRating");
  const search = u.searchParams.get("q");
  return NextResponse.json({
    items: await listHistory({
      minRating: minRating ? Number(minRating) : undefined,
      search: search ?? undefined,
    }),
  });
}
