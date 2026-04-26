import { NextResponse } from "next/server";
import { getClient } from "@/db";

export const maxDuration = 30;

// POST: generate a food photo with Imagen 4 Fast and cache it in Turso.
// Accepts { title, cuisine?, description?, forceRefresh? }
export async function POST(req: Request) {
  const { title, cuisine, description, forceRefresh } = await req
    .json()
    .catch(() => ({ title: "", cuisine: "", description: "", forceRefresh: false }));
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const db = await getClient();

  if (forceRefresh) {
    await db.execute({ sql: "DELETE FROM food_images WHERE title = ?", args: [title] });
  } else {
    const exists = await db.execute({
      sql: "SELECT 1 FROM food_images WHERE title = ?",
      args: [title],
    });
    if (exists.rows.length > 0) {
      return NextResponse.json({ cached: true });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 501 });
  }

  // Ground the prompt in the specific dish, not just the cuisine name.
  // Without this, Imagen defaults to the most iconic food of the cuisine (e.g. sushi for Asian).
  const descClause = description ? ` It looks like: ${description}` : "";
  const cuisineClause = cuisine ? ` ${cuisine} cuisine style.` : "";
  const prompt = `Appetizing food photography for a recipe card. The dish is: "${title}".${descClause} Show this exact dish — do not substitute with a different food. Overhead or 45-degree angle shot, plated on a ceramic dish or rustic pan, warm natural daylight, shallow depth of field, restaurant-quality styling.${cuisineClause} No text, no watermarks, no people.`;

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "16:9" },
        }),
        signal: AbortSignal.timeout(25000),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Imagen API error", status: res.status, details: text },
        { status: 502 },
      );
    }

    const json = await res.json();
    const pred = json.predictions?.[0];
    const b64 = pred?.bytesBase64Encoded as string | undefined;
    const mime = (pred?.mimeType as string | undefined) ?? "image/png";
    if (!b64) {
      return NextResponse.json(
        { error: "No image in response", raw: json },
        { status: 502 },
      );
    }

    await db.execute({
      sql: "INSERT OR REPLACE INTO food_images (title, image_data, mime_type) VALUES (?, ?, ?)",
      args: [title, b64, mime],
    });

    return NextResponse.json({ cached: true, bytes: Math.round((b64.length * 3) / 4) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 502 });
  }
}
