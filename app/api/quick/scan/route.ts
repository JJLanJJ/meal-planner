import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { image, mimeType } = await req.json() as { image: string; mimeType: string };

  if (!image) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  // Strip data URL prefix if present
  const base64 = image.includes(",") ? image.split(",")[1] : image;
  const safeType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: safeType, data: base64 },
          },
          {
            type: "text",
            text: 'List every food ingredient you can identify in this image. Return ONLY a JSON array of short ingredient name strings — no explanations, no markdown, just the array. Example: ["chicken thighs","garlic","lemon","olive oil"]. If this is not a food image, return [].',
          },
        ],
      },
    ],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    const ingredients: string[] = match ? JSON.parse(match[0]) : [];
    return Response.json({ ingredients });
  } catch {
    return Response.json({ ingredients: [] });
  }
}
