import { NextResponse } from "next/server";
import { getClient } from "@/db";

export const maxDuration = 30;

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// POST: fetch from Pollinations and cache in DB (called by client after browser loads image)
export async function POST(req: Request) {
  const { title } = await req.json().catch(() => ({ title: "" }));
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const db = await getClient();

  // Already cached?
  const exists = await db.execute({
    sql: "SELECT 1 FROM food_images WHERE title = ?",
    args: [title],
  });
  if (exists.rows.length > 0) {
    return NextResponse.json({ cached: true });
  }

  // Fetch from Pollinations
  const prompt = encodeURIComponent(`${title} plated dish food photography`);
  const seed = hashCode(title);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=400&nologo=true&seed=${seed}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      return NextResponse.json({ error: "image too small" }, { status: 502 });
    }

    await db.execute({
      sql: "INSERT OR REPLACE INTO food_images (title, image_data) VALUES (?, ?)",
      args: [title, buf.toString("base64")],
    });

    return NextResponse.json({ cached: true, size: buf.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
