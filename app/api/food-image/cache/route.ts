import { NextResponse } from "next/server";
import { getClient } from "@/db";

export const maxDuration = 15;

// POST: search Pexels for a food photo and cache in DB
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

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) {
    return NextResponse.json({ error: "no image provider configured" }, { status: 501 });
  }

  try {
    // Search Pexels for a food photo matching the dish title
    const query = encodeURIComponent(`${title} food dish`);
    const searchRes = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: pexelsKey },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!searchRes.ok) {
      return NextResponse.json({ error: "pexels search failed" }, { status: 502 });
    }

    const data = await searchRes.json();
    const photo = data.photos?.[0];
    if (!photo) {
      return NextResponse.json({ error: "no photos found" }, { status: 404 });
    }

    // Fetch the medium-sized image
    const imageUrl = photo.src?.medium || photo.src?.small;
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) {
      return NextResponse.json({ error: "image fetch failed" }, { status: 502 });
    }

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 1000) {
      return NextResponse.json({ error: "image too small" }, { status: 502 });
    }

    // Determine content type from URL
    const isJpeg = imageUrl.includes(".jpeg") || imageUrl.includes(".jpg");
    const contentType = isJpeg ? "image/jpeg" : "image/png";

    await db.execute({
      sql: "INSERT OR REPLACE INTO food_images (title, image_data) VALUES (?, ?)",
      args: [title, buf.toString("base64")],
    });

    return NextResponse.json({ cached: true, size: buf.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
