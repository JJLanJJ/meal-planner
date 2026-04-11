import { NextResponse } from "next/server";
import { getClient } from "@/db";

export const maxDuration = 30;

// POST: generate a food photo with Imagen 4 Fast and cache it in Turso.
export async function POST(req: Request) {
  const { title, cuisine } = await req
    .json()
    .catch(() => ({ title: "", cuisine: "" }));
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 501 });
  }

  // Craft a prompt tuned for appetizing recipe card photos.
  const cuisineClause = cuisine ? `, ${cuisine} cuisine` : "";
  const prompt = `Professional overhead food photography of ${title}${cuisineClause}. Plated on a ceramic dish with subtle garnish, warm natural daylight, soft shadows, shallow depth of field, rustic wooden table background, appetizing and restaurant-quality styling. No text, no watermarks, no people.`;

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
