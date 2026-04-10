import { NextResponse } from "next/server";
import { getClient } from "@/db";

export const maxDuration = 30; // Vercel function timeout

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const db = await getClient();

  // Check cache first
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

  // Generate via Pollinations (free, no API key)
  const prompt = encodeURIComponent(
    `${title} plated dish food photography`
  );
  const seed = hashCode(title);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=400&nologo=true&seed=${seed}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });

    if (!res.ok) {
      console.error("Pollinations failed:", res.status);
      return placeholderResponse();
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length < 1000) {
      // Too small — probably an error page
      return placeholderResponse();
    }

    // Cache in DB as base64
    const base64 = buf.toString("base64");
    await db.execute({
      sql: "INSERT OR REPLACE INTO food_images (title, image_data) VALUES (?, ?)",
      args: [title, base64],
    }).catch((e) => console.error("Cache write failed:", e));

    return new Response(buf, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("Image fetch error:", e);
    return placeholderResponse();
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function placeholderResponse(): Response {
  // 1x1 transparent PNG as fallback
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "base64"
  );
  return new Response(pixel, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-cache",
    },
  });
}
