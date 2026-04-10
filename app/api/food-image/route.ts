import { getClient } from "@/db";

// GET: serve from cache only (fast, no external calls)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) {
    return new Response("title required", { status: 400 });
  }

  const db = await getClient();
  const cached = await db.execute({
    sql: "SELECT image_data FROM food_images WHERE title = ?",
    args: [title],
  });

  if (cached.rows.length > 0) {
    const data = cached.rows[0].image_data as string;
    const buf = Buffer.from(data, "base64");
    return new Response(buf, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Not cached — return 404 so client falls back to Pollinations direct
  return new Response(null, { status: 404 });
}
