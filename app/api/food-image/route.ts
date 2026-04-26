import { getClient } from "@/db";

// DELETE: purge one or all cached images so they can be regenerated
// ?title=... clears a single entry; no param clears all
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const db = await getClient();
  if (title) {
    await db.execute({ sql: "DELETE FROM food_images WHERE title = ?", args: [title] });
  } else {
    await db.execute({ sql: "DELETE FROM food_images", args: [] });
  }
  return new Response(null, { status: 204 });
}

// GET: serve from cache only (fast, no external calls)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) {
    return new Response("title required", { status: 400 });
  }

  const db = await getClient();
  const cached = await db.execute({
    sql: "SELECT image_data, mime_type FROM food_images WHERE title = ?",
    args: [title],
  });

  if (cached.rows.length > 0) {
    const data = cached.rows[0].image_data as string;
    const mime = (cached.rows[0].mime_type as string | null) ?? "image/png";
    const buf = Buffer.from(data, "base64");
    return new Response(buf as BodyInit, {
      headers: {
        "content-type": mime,
        "cache-control": "no-store",
      },
    });
  }

  return new Response(null, { status: 404 });
}
