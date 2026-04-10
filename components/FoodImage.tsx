"use client";

import { useState, useEffect } from "react";

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pollinationsUrl(title: string): string {
  const prompt = encodeURIComponent(`${title} plated dish food photography`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=400&nologo=true&seed=${hashCode(title)}`;
}

export function FoodImage({
  title,
  height = 160,
}: {
  title: string;
  height?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const cacheUrl = `/api/food-image?title=${encodeURIComponent(title)}`;

  useEffect(() => {
    // Try cache first (fast), fall back to Pollinations direct
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 1) {
        setSrc(cacheUrl);
      }
    };
    img.onerror = () => {
      if (!cancelled) setSrc(pollinationsUrl(title));
    };
    img.src = cacheUrl;

    // Set Pollinations as fallback after 2s if cache hasn't responded
    const timer = setTimeout(() => {
      if (!cancelled && !src) {
        setSrc(pollinationsUrl(title));
      }
    }, 2000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [title, cacheUrl]);

  // Once image loads from Pollinations, fire a background cache write
  useEffect(() => {
    if (loaded && src?.includes("pollinations")) {
      fetch(`/api/food-image/cache`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
    }
  }, [loaded, src, title]);

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
      {src && !failed && (
        <img
          src={src}
          alt={title}
          crossOrigin="anonymous"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease-in",
          }}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (src.includes("pollinations")) {
              setFailed(true);
            } else {
              // Cache miss/error — try Pollinations direct
              setSrc(pollinationsUrl(title));
            }
          }}
        />
      )}
      {!loaded && (
        <span style={{ position: "absolute", fontSize: "1.5rem", opacity: 0.3 }}>
          {failed ? "🍽️" : ""}
        </span>
      )}
    </div>
  );
}
