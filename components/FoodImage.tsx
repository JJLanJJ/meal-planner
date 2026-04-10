"use client";

import { useState } from "react";

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function imageUrl(title: string, attempt: number): string {
  const prompt = encodeURIComponent(`${title}, food photography, plated dish`);
  const seed = hashCode(title) + attempt;
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=400&nologo=true&seed=${seed}`;
}

export function FoodImage({
  title,
  height = 160,
}: {
  title: string;
  height?: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const maxRetries = 2;

  return (
    <div
      style={{
        height,
        background: "linear-gradient(135deg, #E8E0D4 0%, #D4C9B8 100%)",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {!failed && (
        <img
          src={imageUrl(title, attempt)}
          alt={title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease-in",
          }}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (attempt < maxRetries) {
              setAttempt((a) => a + 1);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
      {!loaded && (
        <span
          style={{
            position: "absolute",
            fontSize: "2.5rem",
            opacity: 0.4,
          }}
        >
          🍽️
        </span>
      )}
    </div>
  );
}
