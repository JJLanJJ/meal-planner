import { NextResponse } from "next/server";
import { getClient } from "@/db";

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
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Generate via Gemini Imagen
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const prompt = `Professional food photography of "${title}". Overhead shot on a rustic wooden table, natural window lighting, beautifully plated, shallow depth of field, appetizing and warm.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageGenerationConfig: {
            numberOfImages: 1,
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini image gen failed:", res.status, err);
    return NextResponse.json({ error: "Image generation failed", status: res.status }, { status: 502 });
  }

  const json = await res.json();

  // Extract base64 image from response
  const parts = json.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

  if (!imagePart) {
    console.error("No image in Gemini response:", JSON.stringify(json).slice(0, 500));
    return NextResponse.json({ error: "No image returned" }, { status: 502 });
  }

  const base64 = imagePart.inlineData.data;

  // Cache in DB
  await db.execute({
    sql: "INSERT OR REPLACE INTO food_images (title, image_data) VALUES (?, ?)",
    args: [title, base64],
  });

  const buf = Buffer.from(base64, "base64");
  return new Response(buf, {
    headers: {
      "content-type": imagePart.inlineData.mimeType || "image/png",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
