"use client";

import { useState } from "react";

export function FoodImage({
  title,
  height = 160,
}: {
  title: string;
  height?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const src = `/api/food-image?title=${encodeURIComponent(title)}`;

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
          src={src}
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
          onError={() => setFailed(true)}
        />
      )}
      {!loaded && (
        <span
          style={{
            position: "absolute",
            fontSize: "2rem",
            opacity: 0.3,
          }}
        >
          {failed ? "🍽️" : "⏳"}
        </span>
      )}
    </div>
  );
}
