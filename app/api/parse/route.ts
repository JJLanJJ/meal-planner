import { NextResponse } from "next/server";
import { parseOrder } from "@/lib/parse-order";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  return NextResponse.json({ items: parseOrder(text) });
}
